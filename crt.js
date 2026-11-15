/*
  crt.js: the CRT monitors of DOSBox Staging, for still pictures, in WebGL2.

  A port of the shaders behind DOSBox Staging's adaptive CRT settings (crt-auto, crt-auto-machine and
  crt-auto-arcade; its resources/glshaders/crt/*.glsl files, version 0.82), with the rules it uses to pick one for
  a monitor and a screen size. Ported to WebGL2 and changed for this site by The Paninos off-line, October and
  November 2026.

  1. crt-hyllian, with DOSBox Staging's presets. Its notice:

       Hyllian's CRT Shader

       Copyright (C) 2020-2024  The DOSBox Staging Team

       Copyright (C) 2011-2020 Hyllian - sergiogdb@gmail.com

       Copyright (C) 2020, this file ported from Libretro's GLSL
       shader crt-hyllian.glslp to DOSBox-compatible format by Tyrells.

       Permission is hereby granted, free of charge, to any person obtaining a copy
       of this software and associated documentation files (the "Software"), to deal
       in the Software without restriction, including without limitation the rights
       to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
       copies of the Software, and to permit persons to whom the Software is
       furnished to do so, subject to the following conditions:

       The above copyright notice and this permission notice shall be included in
       all copies or substantial portions of the Software.

       THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
       IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
       FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
       AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
       LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
       OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
       THE SOFTWARE.

     The mask functions in it are by hunterk (public domain).

  2. 'vga-1080p' and 'vga-1080p-fake-double-scan', the shaders DOSBox uses for VGA at 2 pixels per scanline: the
     fake double scan for 200-line modes (4 or 5 pixels per line of the picture, every other pixel row dimmed),
     vga-1080p for 400 and 480-line modes. Copyright (C) 2020-2024 The DOSBox Staging Team. Based on parts of the
     Caligari shader plus bits and pieces from Hyllian, Easymode, and probably a few others. GNU GPL v2 or later.

  Added for this site:
  - curvature and rounded corners from crt-guest-advanced-hd (its pass2 and deconvergence-hd passes), Copyright (C)
    2018-2025 guest(r), and the vignette from its pre-shaders-afterglow pass, Copyright (C) 2019-2025 guest(r) and
    Dr. Venom. GNU GPL v2 or later;
  - a zoomed view (a part of the picture drawn at full resolution instead of magnified);
  - the site's own answers where a screen has too few pixels for a monitor's scanlines: the lines blended away
    ('flat'), or, at 2 pixels per line on a 15 kHz monitor, one pixel row on each line's centre ('half').

  As a whole this file is free software; you can redistribute it and/or modify it under the terms of the GNU
  General Public License as published by the Free Software Foundation; either version 2 of the License, or (at
  your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
  Public License for more details. A copy of the licence is published with the site as licenses/GPL-2.0.txt, and
  the notices of the original shaders as licenses/crt-shaders-GPL.txt.

  Use:
    const crt = new CRT.Renderer(canvas);                  // throws if WebGL2 is missing
    crt.setSource({ w, h, data });                          // the picture at its native resolution, RGBA bytes
    const p = CRT.plan('31khz', h, canvas.height);          // what DOSBox would put on a screen that tall
    crt.draw(p.preset, { rect: [x, y, w, p.height], flat: p.flat, half: p.half });
*/
(function () {
  'use strict';

  const VS = `#version 300 es
in vec2 aPos;
out vec2 vTexCoord;
void main() {
  vTexCoord = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);   // 0,0 at the top left of the rect
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FS = `#version 300 es
precision highp float;
in vec2 vTexCoord;
out vec4 FragColor;

uniform sampler2D s_p;
uniform vec2 TexSize;        // the picture as the monitor receives it: pixel-doubled and double-scanned the way DOSBox does
uniform vec4 OutputSize;     // the whole picture on the screen, in device pixels (w, h, 1/w, 1/h)
uniform vec4 OriginalSize;   // the picture's own pixels
uniform vec4 uView;          // the part of the picture this rect shows (x, y, w, h), 0..1
uniform vec4 uAA;            // crt-hyllian: samples across and down, and the span they cover in picture coordinates
uniform float uMode;         // 0 crt-hyllian, 1 vga-1080p, 2 vga-1080p-fake-double-scan
uniform float uShiftY;       // crt-hyllian: moves the pixel rows against the scanlines
uniform float oimage;        // split view: the raw picture left of this x
// crt-hyllian
uniform float HFILTER_PROFILE, BEAM_MIN_WIDTH, BEAM_MAX_WIDTH, SCANLINES_STRENGTH, COLOR_BOOST, SHARPNESS_HACK,
	PHOSPHOR_LAYOUT, MASK_INTENSITY, CRT_ANTI_RINGING, INPUT_GAMMA, OUTPUT_GAMMA, BLACK_LEVEL;
// vga-1080p and its fake double scan
uniform float SPOT_WIDTH, SPOT_HEIGHT, SCANLINE_STRENGTH_MIN, SCANLINE_STRENGTH_MAX, COLOR_BOOST_EVEN, COLOR_BOOST_ODD,
	MASK_STRENGTH, GAMMA_INPUT, GAMMA_OUTPUT;
// the tube (added for this site)
uniform float warpX, warpY, c_shape, csize, bsize1, sborder, vigstr, vigdef;

// taps outside the picture repeat its edge pixel, as in DOSBox (the texture clamps to its edge)
vec4 texb(sampler2D s, vec2 uv) { return texture(s, uv); }

/* ---- from crt-guest-advanced-hd (GPL v2 or later): vignette (guest(r) and Dr. Venom), curvature and corners (guest(r)) ---- */
float vignette(vec2 pos, vec4 src) {
	vec2 b = vec2(vigdef, vigdef) * vec2(1.0, src.x/src.y) * 0.125;
	pos = clamp(pos, 0.0, 1.0);
	pos = abs(2.0*(pos - 0.5));
	vec2 res = 1.0 - smoothstep(vec2(1.0)-b, vec2(1.0), sqrt(pos));
	res = pow(res, vec2(0.70));
	return max(mix(1.0, sqrt(res.x*res.y), vigstr), 0.0);
}

vec2 Warp(vec2 pos)
{
	pos  = pos*2.0-1.0;
	pos  = mix(pos, vec2(pos.x*inversesqrt(1.0-c_shape*pos.y*pos.y), pos.y*inversesqrt(1.0-c_shape*pos.x*pos.x)), vec2(warpX, warpY)/max(c_shape, 0.001));
	return pos*0.5 + 0.5;
}

float corner(vec2 pos) {
	pos = abs(2.0*(pos - 0.5));
	vec2 aspect = vec2(1.0, OutputSize.x/OutputSize.y);
	float b = bsize1 * 0.05 + 0.0005; pos.y = pos.y + b*(aspect.y - 1.0);
	vec2 crn = max(vec2(csize),vec2(2.0*b+0.0015));
	vec2 cp = max(pos-(1.0-crn*aspect),0.0)/aspect; float cd = sqrt(dot(cp,cp));
	pos = max(pos, 1.0-crn+cd);
	float res = mix(1.0, 0.0, smoothstep(1.0-b, 1.0, sqrt(max(pos.x,pos.y))));
	return pow(res, sborder);
}

/* ---- phosphor masks (hunterk, public domain), the layouts DOSBox Staging's presets use ---- */
vec3 mask_weights(vec2 coord, float mask_intensity, int phosphor_layout) {
	vec3 weights = vec3(1.0);
	float on = 1.0;
	float off = 1.0 - mask_intensity;
	vec3 red     = vec3(on,  off, off);
	vec3 green   = vec3(off, on,  off);
	vec3 blue    = vec3(off, off, on );
	vec3 magenta = vec3(on,  off, on );
	vec3 yellow  = vec3(on,  on,  off);
	vec3 cyan    = vec3(off, on,  on );
	vec3 black   = vec3(off, off, off);
	int w, z = 0;
	vec3 aperture_weights = mix(magenta, green, floor(mod(coord.x, 2.0)));

	if (phosphor_layout == 0) return weights;
	else if (phosphor_layout == 1) return aperture_weights;
	else if (phosphor_layout == 2) {
		vec3 inverse_aperture = mix(green, magenta, floor(mod(coord.x, 2.0)));
		return mix(aperture_weights, inverse_aperture, floor(mod(coord.y, 2.0)));
	}
	else if (phosphor_layout == 4) return mix(yellow, blue, floor(mod(coord.x, 2.0)));
	else if (phosphor_layout == 9) {
		vec3 big_ap_rgb[4] = vec3[4](red, yellow, cyan, blue);
		w = int(floor(mod(coord.x, 4.0)));
		return big_ap_rgb[w];
	}
	else if (phosphor_layout == 11) {
		vec3 delta_1_1[4] = vec3[4](red, green, blue, black);
		vec3 delta_1_2[4] = vec3[4](blue, black, red, green);
		w = int(floor(mod(coord.y, 2.0)));
		z = int(floor(mod(coord.x, 4.0)));
		return (w == 1) ? delta_1_1[z] : delta_1_2[z];
	}
	else if (phosphor_layout == 14) {
		vec3 slot2_1[6] = vec3[6](magenta, green, black, black,   black, black);
		vec3 slot2_2[6] = vec3[6](magenta, green, black, magenta, green, black);
		vec3 slot2_3[6] = vec3[6](black,   black, black, magenta, green, black);
		w = int(floor(mod(coord.y, 3.0)));
		z = int(floor(mod(coord.x, 6.0)));
		return (w == 1) ? slot2_1[z] : (w == 2) ? slot2_2[z] : slot2_3[z];
	}
	else if (phosphor_layout == 17) {
		vec3 slot_1[10] = vec3[10](red,   magenta, blue,  green, green, red,   magenta, blue,  green, green);
		vec3 slot_2[10] = vec3[10](black, blue,    blue,  green, green, red,   red,     black, black, black);
		vec3 slot_3[10] = vec3[10](red,   magenta, blue,  green, green, red,   magenta, blue,  green, green);
		vec3 slot_4[10] = vec3[10](red,   red,     black, black, black, black, blue,    blue,  green, green);
		w = int(floor(mod(coord.y, 4.0)));
		z = int(floor(mod(coord.x, 10.0)));
		return (w == 1) ? slot_1[z] : (w == 2) ? slot_2[z] : (w == 3) ? slot_3[z] : slot_4[z];
	}
	return weights;
}

/* ---- crt-hyllian (MIT): one sample at picture coordinate p, in linear light, before the mask ---- */
#define GAMMA_IN(color)   pow(color, vec4(INPUT_GAMMA))

mat4 get_hfilter_profile()
{
	float bf = 0.0;
	float cf = 0.0;
	if (HFILTER_PROFILE == 1.0) { bf = 0.0; cf = 0.5; }
	return mat4(
		(-bf - 6.0*cf)/6.0,          (3.0*bf + 12.0*cf)/6.0, (-3.0*bf - 6.0*cf)/6.0,             bf/6.0,
		(12.0 - 9.0*bf - 6.0*cf)/6.0, (-18.0 + 12.0*bf  + 6.0*cf)/6.0,                    0.0, (6.0 - 2.0*bf)/6.0,
		-(12.0 - 9.0*bf - 6.0*cf)/6.0,  (18.0 - 15.0*bf - 12.0*cf)/6.0,  (3.0*bf + 6.0*cf)/6.0,             bf/6.0,
		(bf + 6.0*cf)/6.0,                        -cf,                         0.0,                0.0
	);
}

vec4 hyllian(vec2 p)
{
	vec2 TextureSize = vec2(TexSize.x * SHARPNESS_HACK, TexSize.y);

	vec2 dx = vec2(1.0/TextureSize.x, 0.0);
	vec2 dy = vec2(0.0, 1.0/TextureSize.y);

	vec2 pix_coord = p * TextureSize + vec2(-0.5, 0.5);
	vec2 tc = (floor(pix_coord) + vec2(0.5, 0.5)) / TextureSize;
	vec2 fp = fract(pix_coord);

	vec4 c00 = GAMMA_IN(texb(s_p, tc     - dx - dy)) + BLACK_LEVEL;
	vec4 c01 = GAMMA_IN(texb(s_p, tc          - dy)) + BLACK_LEVEL;
	vec4 c02 = GAMMA_IN(texb(s_p, tc     + dx - dy)) + BLACK_LEVEL;
	vec4 c03 = GAMMA_IN(texb(s_p, tc + 2.0*dx - dy)) + BLACK_LEVEL;

	vec4 c10 = GAMMA_IN(texb(s_p, tc     - dx)) + BLACK_LEVEL;
	vec4 c11 = GAMMA_IN(texb(s_p, tc         )) + BLACK_LEVEL;
	vec4 c12 = GAMMA_IN(texb(s_p, tc     + dx)) + BLACK_LEVEL;
	vec4 c13 = GAMMA_IN(texb(s_p, tc + 2.0*dx)) + BLACK_LEVEL;

	mat4 invX = get_hfilter_profile();

	mat4 color_matrix0 = mat4(c00, c01, c02, c03);
	mat4 color_matrix1 = mat4(c10, c11, c12, c13);

	vec4 invX_Px = vec4(fp.x*fp.x*fp.x, fp.x*fp.x, fp.x, 1.0) * invX;
	vec4 color0  = color_matrix0 * invX_Px;
	vec4 color1  = color_matrix1 * invX_Px;

	vec4 min_sample0 = min(c01, c02);
	vec4 max_sample0 = max(c01, c02);
	vec4 min_sample1 = min(c11, c12);
	vec4 max_sample1 = max(c11, c12);

	// Anti-ringing
	vec4 aux = color0;
	color0 = clamp(color0, min_sample0, max_sample0);
	color0 = mix(aux, color0, CRT_ANTI_RINGING * step(0.0, (c00-c01)*(c02-c03)));
	aux = color1;
	color1 = clamp(color1, min_sample1, max_sample1);
	color1 = mix(aux, color1, CRT_ANTI_RINGING * step(0.0, (c10-c11)*(c12-c13)));

	float pos0 = fp.y;
	float pos1 = 1.0 - fp.y;

	vec4 lum0 = mix(vec4(BEAM_MIN_WIDTH), vec4(BEAM_MAX_WIDTH), color0);
	vec4 lum1 = mix(vec4(BEAM_MIN_WIDTH), vec4(BEAM_MAX_WIDTH), color1);

	vec4 d0 = 4.0 * SCANLINES_STRENGTH * pos0 / (lum0 + 0.0000001);
	vec4 d1 = 4.0 * SCANLINES_STRENGTH * pos1 / (lum1 + 0.0000001);

	d0 = exp(-d0*d0);
	d1 = exp(-d1*d1);

	return COLOR_BOOST * (color0*d0 + color1*d1);
}

/* ---- DOSBox Staging's vga-1080p shaders (GPL v2 or later) ---- */
// the texture has no alpha in DOSBox: it reads 1, and the overlay's length() counts it
vec4 texg(vec2 uv) { return vec4(pow(texb(s_p, uv).rgb, vec3(GAMMA_INPUT)), 1.0); }
vec4 texe(vec2 uv) { return vec4(pow(texture(s_p, clamp(uv, 0.0, 1.0)).rgb, vec3(GAMMA_INPUT)), 1.0); }

float spot(float w) { if (w > 1.0) w = 1.0; w = 1.0 - w * w; return w * w; }

// vga-1080p: a spot per pixel, blended with its nearest neighbours
vec4 caligari(vec2 p)
{
	vec2 onex = vec2(1.0 / TexSize.x, 0.0);
	vec2 oney = vec2(0.0, 1.0 / TexSize.y);
	vec2 coords = p * TexSize;
	vec2 pixel_center = floor(coords) + vec2(0.5, 0.5);
	vec2 texture_coords = pixel_center / TexSize;

	vec4 color = texg(texture_coords);

	float dx = coords.x - pixel_center.x;
	float h_weight_00 = spot(dx / SPOT_WIDTH);
	color *= vec4(h_weight_00);

	// get closest horizontal neighbour to blend
	vec2 coords01;
	if (dx > 0.0) { coords01 = onex; dx = 1.0 - dx; } else { coords01 = -onex; dx = 1.0 + dx; }
	vec4 colorNB = texg(texture_coords + coords01);
	float h_weight_01 = spot(dx / SPOT_WIDTH);
	color = color + colorNB * vec4(h_weight_01);

	// Vertical Blending
	float dy = coords.y - pixel_center.y;
	float v_weight_00 = spot(dy / SPOT_HEIGHT);
	color *= vec4(v_weight_00);

	// get closest vertical neighbour to blend
	vec2 coords10;
	if (dy > 0.0) { coords10 = oney; dy = 1.0 - dy; } else { coords10 = -oney; dy = 1.0 + dy; }
	colorNB = texg(texture_coords + coords10);
	float v_weight_10 = spot(dy / SPOT_HEIGHT);
	color = color + colorNB * vec4(v_weight_10 * h_weight_00);

	colorNB = texg(texture_coords + coords01 + coords10);
	color = color + colorNB * vec4(v_weight_10 * h_weight_01);
	return color;
}

// vga-1080p-fake-double-scan: the single-scanned picture, sharp-bilinear
vec4 sharp(vec2 p)
{
	const vec2 halfp = vec2(0.5);
	vec2 lores = p * TexSize;
	vec2 prescale = ceil(OutputSize.xy / TexSize);
	vec2 texel_floored = floor(lores);
	vec2 s = fract(lores);
	vec2 region_range = halfp - halfp / prescale;
	vec2 center_dist = s - halfp;
	vec2 f = (center_dist - clamp(center_dist, -region_range, region_range)) * prescale + halfp;
	vec2 mod_texel = min(texel_floored + f, TexSize - halfp);

	// bilinear, in linear light
	vec2 texCoord = mod_texel - vec2(0.5);
	vec2 s0t0 = floor(texCoord) + vec2(0.5);
	vec4 c_s0t0 = texe(s0t0 / TexSize);
	vec4 c_s0t1 = texe((s0t0 + vec2(0.0, 1.0)) / TexSize);
	vec4 c_s1t0 = texe((s0t0 + vec2(1.0, 0.0)) / TexSize);
	vec4 c_s1t1 = texe((s0t0 + vec2(1.0)) / TexSize);
	vec2 weight = fract(texCoord);
	vec4 c0 = c_s0t0 + (c_s1t0 - c_s0t0) * weight.x;
	vec4 c1 = c_s0t1 + (c_s1t1 - c_s0t1) * weight.x;
	return (c0 + (c1 - c0) * weight.y);
}

// both: every other device row dimmed, then the mask
vec4 add_vga_overlay(vec4 color, vec2 mask_coords, float even_odd)
{
	vec3 lum_factors = vec3(0.2126, 0.7152, 0.0722);
	float luminance = dot(lum_factors, color.rgb);

	float dim_factor = mix(1.0 - SCANLINE_STRENGTH_MAX, 1.0 - SCANLINE_STRENGTH_MIN, luminance);
	float scanline_dim = clamp(even_odd + dim_factor, 0.0, 1.0);

	color.rgb *= vec3(scanline_dim);

	// color boost
	color.rgb *= mix(vec3(COLOR_BOOST_EVEN), vec3(COLOR_BOOST_ODD), even_odd);

	float saturation = mix(1.2, 1.03, even_odd);
	float l = length(color);
	color.r = pow(color.r + 1e-7, saturation);
	color.g = pow(color.g + 1e-7, saturation);
	color.b = pow(color.b + 1e-7, saturation);
	color = normalize(color)*l;

	// mask
	color.rgb *= mask_weights(mask_coords, MASK_STRENGTH, int(PHOSPHOR_LAYOUT));
	return color;
}

void main()
{
	// where on the picture this pixel is, before the tube bends it
	vec2 scr = uView.xy + vTexCoord * uView.zw;
	// split view: the raw picture left of the line
	if (scr.x < oimage - 0.00025) { FragColor = vec4(texture(s_p, scr).rgb, 1.0); return; }
	vec2 pos = Warp(scr);
	// the device pixel within the picture, rows counted from the bottom as DOSBox counts them (gl_FragCoord): the
	// mask and the dimmed rows sit on the glass, so they don't bend or pan
	vec2 dev = floor(scr * OutputSize.xy);
	dev.y = floor(OutputSize.y + 0.5) - 1.0 - dev.y;
	vec4 color;

	if (uMode < 0.5) {
		vec3 mw = mask_weights(dev, MASK_INTENSITY, int(PHOSPHOR_LAYOUT));
		int nx = int(uAA.x), ny = int(uAA.y);
		vec4 acc = vec4(0.0);
		for (int j = 0; j < ny; j++) for (int i = 0; i < nx; i++) {
			vec2 o = (vec2(float(i), float(j)) + 0.5) / vec2(float(nx), float(ny)) - 0.5;
			vec4 h = hyllian(pos + o * uAA.zw + vec2(0.0, uShiftY));
			h.rgb *= mw;
			// each sample is clamped like a pixel of its own, so an average keeps the brightness of the scanlined picture
			acc += clamp(h, 0.0, 1.0);
		}
		color = pow(acc / float(nx * ny), vec4(1.0 / OUTPUT_GAMMA));
	} else {
		color = uMode < 1.5 ? caligari(pos) : sharp(pos);
		color = add_vga_overlay(color, dev, floor(mod(dev.y, 2.0)));
		color = clamp(pow(max(color, vec4(0.0)), vec4(1.0 / GAMMA_OUTPUT)), 0.0, 1.0);
	}

	// a tube with every setting at zero leaves DOSBox's picture untouched
	float edge = (csize > 0.0 || bsize1 > 0.0 || warpX > 0.0 || warpY > 0.0) ? corner(pos) : 1.0;
	FragColor = vec4(color.rgb * edge * vignette(pos, OriginalSize), 1.0);
}`;

  /* ---------- DOSBox Staging's presets: the #define block of each resources/glshaders/crt file ----------
     dbl = [x, y]: what DOSBox feeds the shader. VGA doubles 320-column pictures and draws 200-line ones twice; the EGA
     presets force single scan; the CGA and arcade ones also leave the pixels undoubled. */
  const HY_COMMON = { shader: 'hyllian', HFILTER_PROFILE: 0, SHARPNESS_HACK: 1, CRT_ANTI_RINGING: 1, BLACK_LEVEL: 0 };
  const hy = (BEAM_MIN_WIDTH, BEAM_MAX_WIDTH, SCANLINES_STRENGTH, COLOR_BOOST, PHOSPHOR_LAYOUT, MASK_INTENSITY, INPUT_GAMMA, OUTPUT_GAMMA, dbl) =>
    ({ ...HY_COMMON, BEAM_MIN_WIDTH, BEAM_MAX_WIDTH, SCANLINES_STRENGTH, COLOR_BOOST, PHOSPHOR_LAYOUT, MASK_INTENSITY, INPUT_GAMMA, OUTPUT_GAMMA, dbl });
  const PRESETS = {
    'vga-1440p':        hy(0.95, 1.30, 0.85, 2.50,  2, 0.55, 2.40, 2.48, [2, 2]),
    'vga-4k':           hy(1.00, 1.40, 0.90, 3.65, 11, 0.65, 2.40, 2.48, [2, 2]),
    'ega-720p':         hy(0.80, 0.90, 0.65, 1.90,  1, 0.14, 2.40, 2.30, [2, 1]),
    'ega-1080p':        hy(0.85, 1.03, 0.75, 2.65,  1, 0.50, 2.40, 2.30, [2, 1]),
    'ega-1440p':        hy(0.88, 1.10, 0.78, 2.80,  4, 0.60, 2.40, 2.30, [2, 1]),
    'ega-4k':           hy(0.92, 1.13, 0.78, 2.70,  9, 0.60, 2.40, 2.20, [2, 1]),
    'cga-720p':         hy(0.65, 1.00, 0.62, 1.70,  1, 0.22, 2.40, 2.40, [1, 1]),
    'cga-1080p':        hy(0.70, 1.00, 0.65, 2.00,  4, 0.35, 2.40, 2.40, [1, 1]),
    'cga-1440p':        hy(0.73, 1.00, 0.65, 3.20, 11, 0.55, 2.40, 2.40, [1, 1]),
    'cga-4k':           hy(0.65, 1.00, 0.70, 3.40, 17, 0.65, 2.40, 2.40, [1, 1]),
    'arcade-1080p':     hy(1.00, 1.20, 0.75, 2.00, 11, 0.30, 2.40, 2.25, [1, 1]),
    'arcade-1440p':     hy(1.00, 1.20, 0.75, 2.00, 14, 0.30, 2.40, 2.25, [1, 1]),
    'arcade-4k':        hy(1.00, 1.20, 0.75, 2.00, 17, 0.30, 2.40, 2.25, [1, 1]),
    'hercules':         hy(1.20, 1.20, 0.75, 1.50,  0, 0.00, 2.40, 2.40, [1, 1]),
    'monochrome-hires': hy(0.82, 1.00, 0.65, 1.30,  0, 0.00, 2.40, 2.20, [1, 1]),
    'vga-1080p': { shader: 'vga-1080p', SPOT_WIDTH: 0.85, SPOT_HEIGHT: 0.80, PHOSPHOR_LAYOUT: 2, SCANLINE_STRENGTH_MIN: 0.72, SCANLINE_STRENGTH_MAX: 0.83,
      COLOR_BOOST_EVEN: 4.45, COLOR_BOOST_ODD: 1.65, MASK_STRENGTH: 0.10, GAMMA_INPUT: 2.15, GAMMA_OUTPUT: 2.45, dbl: [2, 2] },
    'vga-1080p-fake-double-scan': { shader: 'fake', PHOSPHOR_LAYOUT: 2, SCANLINE_STRENGTH_MIN: 0.80, SCANLINE_STRENGTH_MAX: 0.85,
      COLOR_BOOST_EVEN: 4.80, COLOR_BOOST_ODD: 1.40, MASK_STRENGTH: 0.10, GAMMA_INPUT: 2.40, GAMMA_OUTPUT: 2.62, dbl: [2, 1] },
  };
  // the tube, off: what a preset draws when it says nothing about curvature, corners or vignette
  const TUBE = { warpX: 0, warpY: 0, c_shape: 0.25, csize: 0, bsize1: 0, sborder: 0.75, vigstr: 0, vigdef: 1.0 };

  /* What DOSBox Staging puts on a screen 'height' device pixels tall, for a monitor ('display', from the site's data)
     and a picture of 'lines' lines: the preset, the scanlines the monitor draws, the pixels each one gets ('k') and
     the picture's height, with whole pixels per scanline (DOSBox's integer scaling). Plus the site's own answers:
       flat: true      too few pixels to show the scanlines: they are blended away and the picture fills 'height';
       half: true      2 pixels per line on a 15 kHz monitor (DOSBox needs 3): one pixel row on each line's centre;
       straight: true  lines 2 pixels tall: a curved tube would make bands with them, so the caller should not bend it;
       off: true       DOSBox itself would switch the CRT off at this height (under 2 pixels per scanline on VGA,
                       under 3 on the EGA, CGA and arcade monitors; the mono monitors have no minimum).
     exact: the picture must be 'height' tall (two pictures compared at one size, or 'fit the window'): the same
     answer when that height suits the monitor, else scanlines antialiased from 3.5 pixels per line up (or from the
     number given as 'exact'), else flat.
     vgaPreset: a crt-hyllian preset the VGA monitor keeps at every size, instead of DOSBox's pick by size (and
     instead of its 1080p shaders at 2 pixels per scanline). */
  function plan(display, lines, height, exact, vgaPreset) {
    const mono = display === 'hercules' || display === 'mono-hires';
    const khz15 = display === 'ega15' || display === 'cga15' || display === '15khz-tv' || display === 'tv';
    const vga = !mono && !khz15;
    // VGA draws modes under 350 lines twice
    const scan = vga && lines < 350 ? lines * 2 : lines;
    const std = display === 'ega15' ? 'ega' : display === 'cga15' ? 'cga' : 'arcade';
    const off = mono ? false : Math.floor(height / scan) < (vga ? 2 : 3);
    const make = (name, k, h, more) => ({ name, preset: PRESETS[name], scan, k, height: h, flat: false, half: false, aa: false, straight: false, off, ...more });
    // the crt-hyllian preset for k pixels per scanline
    const hyName = k => vga ? (vgaPreset || (k >= 4 ? 'vga-4k' : 'vga-1440p'))
      : display === 'hercules' ? 'hercules' : display === 'mono-hires' ? 'monochrome-hires'
      : std + (k >= 8 ? '-4k' : k >= 5 ? '-1440p' : k >= 4 || std === 'arcade' ? '-1080p' : '-720p');
    const whole = () => {
      const k = Math.floor(height / scan);
      if (vga) {
        if (k >= 3) return make(hyName(k), k, k * scan);
        if (k === 2 && vgaPreset) return make(vgaPreset, 2, 2 * scan, { straight: true });
        if (k === 2) {
          // double-scanned modes of up to 216 lines: the fake double scan, on the single-scanned picture at 4 or 5
          // pixels per line (2 or 2.5 per VGA scanline). Its dimmed rows are device rows: no bands on a curved tube
          if (scan !== lines && lines <= 216) { const n = Math.floor(height / lines); return make('vga-1080p-fake-double-scan', n / 2, n * lines); }
          return make('vga-1080p', 2, 2 * scan, { straight: true });
        }
      } else if (mono) {
        if (k >= 2) return make(hyName(k), k, k * scan, { straight: k === 2 });
      } else if (k >= 2) return make(hyName(k), k, k * scan, { half: k === 2, straight: k === 2 });
      return null;
    };
    const p = whole();
    if (p && (!exact || p.height === height)) return p;
    const k = height / scan;
    if (exact && k >= (exact === true ? 3.5 : exact)) return make(hyName(Math.floor(k)), k, height, { aa: true });
    return make(hyName(Math.max(3, Math.floor(k))), k, height, { flat: true });
  }

  /* ---------- WebGL2 plumbing ---------- */
  class Renderer {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
      if (!gl) throw new Error('WebGL2 is not available.');
      this.gl = gl;
      this.canvas = canvas;
      const p = gl.createProgram();
      gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VS, 'vertex'));
      gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, FS, 'fragment'));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
      this.prog = p;
      this.uniforms = [];
      for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
        const u = gl.getActiveUniform(p, i);
        this.uniforms.push({ name: u.name, type: u.type, loc: gl.getUniformLocation(p, u.name) });
      }
      // one triangle that covers the viewport
      gl.bindVertexArray(gl.createVertexArray());
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.src = null;
    }
    compile(type, src, name) {
      const gl = this.gl, sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(sh));
      return sh;
    }
    // the picture at its native resolution: { w, h, data: RGBA bytes }
    setSource(img) {
      const gl = this.gl;
      if (this.src) gl.deleteTexture(this.src.tex);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, img.w, img.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.src = { tex, w: img.w, h: img.h };
    }
    /* One still frame. params: a PRESETS entry plus any overrides, the tube settings and oimage (split view).
         o.rect  [x, y, w, h] in device pixels: where in the canvas to draw; the rest is left black. Default: all of it.
         o.view  [x, y, w, h] in 0..1: the part of the picture that rect shows. Default: the whole picture.
         o.flat, o.half: see plan(). */
    draw(params, o = {}) {
      const gl = this.gl, cw = this.canvas.width, ch = this.canvas.height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const R = o.rect || [0, 0, cw, ch], v = o.view || [0, 0, 1, 1];
      if (!this.src || R[2] < 1 || R[3] < 1) return;
      const p = { ...TUBE, ...params }, d = p.dbl || [1, 1], S = this.src;
      // the whole picture on the screen, in device pixels, and what the monitor is fed
      const PW = R[2] / v[2], PH = R[3] / v[3];
      // (DOSBox doubles only pictures under 400 columns, and draws twice only those under 350 lines)
      const tw = S.w * (S.w < 400 ? d[0] : 1), th = S.h * (S.h < 350 ? d[1] : 1);
      // crt-hyllian samples each pixel once, at its centre, when the scanlines fall on whole pixels and the tube is
      // flat: DOSBox's own picture. Otherwise it averages the beam over the pixel, which keeps moire away; 'flat'
      // averages over a whole scanline, which removes the lines and keeps their brightness
      const ppl = PH / th, bent = p.warpX > 0 || p.warpY > 0;
      const whole = Math.abs(ppl - Math.round(ppl)) < 0.02;
      const ny = o.flat ? 8 : whole && !bent ? 1 : ppl < 3 ? 6 : 4;
      const cols = PW / (S.w * p.SHARPNESS_HACK || S.w), nx = cols >= 1 ? 1 : cols >= 0.5 ? 2 : 3;
      const vec = {
        TexSize: [tw, th], OutputSize: [PW, PH, 1 / PW, 1 / PH], OriginalSize: [S.w, S.h, 1 / S.w, 1 / S.h], uView: v,
        uAA: [nx, ny, 1 / PW, o.flat ? 1 / th : 1 / PH],
      };
      const f = { uMode: p.shader === 'vga-1080p' ? 1 : p.shader === 'fake' ? 2 : 0, uShiftY: o.half ? 0.5 / PH : 0 };
      gl.viewport(R[0], ch - R[1] - R[3], R[2], R[3]);
      gl.useProgram(this.prog);
      for (const u of this.uniforms) {
        if (u.type === gl.SAMPLER_2D) {
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex); gl.uniform1i(u.loc, 0);
        } else if (u.type === gl.FLOAT_VEC4) gl.uniform4fv(u.loc, vec[u.name]);
        else if (u.type === gl.FLOAT_VEC2) gl.uniform2fv(u.loc, vec[u.name]);
        else if (u.type === gl.FLOAT) gl.uniform1f(u.loc, +(u.name in f ? f[u.name] : p[u.name]) || 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  const supported = () => {
    try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
  };

  window.CRT = { Renderer, supported, PRESETS, TUBE, plan };
})();
