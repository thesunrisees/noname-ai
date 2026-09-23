/* ================= 决策积分引擎 · 图表工具（无依赖 SVG） ================= */
function _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

export function lineChart(data, opts) {
	try {
		const o = Object.assign({ width: 320, height: 100, color: "#7fe3a0", fill: "rgba(127,227,160,0.15)", grid: true }, opts || {});
		if (!data || !data.length) return "<div style='color:#666;font-size:11px;'>暂无数据</div>";
		const max = Math.max.apply(null, data);
		const min = Math.min.apply(null, data);
		const range = Math.max(1, max - min);
		const stepX = o.width / Math.max(1, data.length - 1);
		const y = function (v) { return o.height - ((v - min) / range) * (o.height - 20) - 10; };
		let path = "";
		for (let i = 0; i < data.length; i++) {
			const x = Math.round(i * stepX);
			const yy = Math.round(y(data[i]));
			path += (i === 0 ? "M" : "L") + x + "," + yy + " ";
		}
		const area = path + "L" + o.width + "," + o.height + " L0," + o.height + " Z";
		let s = "<svg width='" + o.width + "' height='" + o.height + "' style='display:block;'>";
		if (o.grid) {
			for (let gy = 0; gy <= o.height; gy += 20) {
				s += "<line x1='0' y1='" + gy + "' x2='" + o.width + "' y2='" + gy + "' stroke='#1a2637' stroke-width='1'/>";
			}
		}
		s += "<path d='" + area + "' fill='" + o.fill + "'/>";
		s += "<path d='" + path + "' fill='none' stroke='" + o.color + "' stroke-width='2'/>";
		for (let i = 0; i < data.length; i++) {
			const x = Math.round(i * stepX);
			const yy = Math.round(y(data[i]));
			s += "<circle cx='" + x + "' cy='" + yy + "' r='2' fill='" + o.color + "'/>";
		}
		s += "<text x='2' y='" + (o.height - 2) + "' fill='#666' font-size='9'>" + min + "</text>";
		s += "<text x='" + (o.width - 30) + "' y='12' fill='#666' font-size='9'>" + max + "</text>";
		s += "</svg>";
		return s;
	} catch (e) { return "<div style='color:#666;font-size:11px;'>图表异常</div>"; }
}

export function barChart(items, opts) {
	try {
		const o = Object.assign({ width: 300, barH: 14, gap: 4, colors: ["#7fe3a0", "#9ad8ff", "#ffd479", "#ff9c9c"] }, opts || {});
		if (!items || !items.length) return "<div style='color:#666;font-size:11px;'>暂无数据</div>";
		const max = Math.max.apply(null, items.map(function (it) { return Math.abs(it.value || it.count || 0); })) || 1;
		let s = "<div style='font-size:11px;'>";
		items.forEach(function (it, i) {
			const v = Math.abs(it.value !== undefined ? it.value : it.count) || 0;
			const pct = Math.round((v / max) * 100);
			const col = it.color || o.colors[i % o.colors.length];
			s += "<div style='display:flex;align-items:center;gap:6px;margin:" + (o.gap / 2) + "px 0;'>";
			s += "<span style='min-width:72px;color:#dbe7f5;'>" + _esc(it.label || "?") + "</span>";
			s += "<span style='flex:1;height:" + o.barH + "px;background:#14243c;border-radius:3px;overflow:hidden;'>";
			s += "<span style='display:block;width:" + pct + "%;height:100%;background:" + col + ";'></span>";
			s += "</span>";
			s += "<span style='width:48px;text-align:right;color:" + col + ";'>" + v + "</span>";
			s += "</div>";
		});
		s += "</div>";
		return s;
	} catch (e) { return "<div style='color:#666;font-size:11px;'>图表异常</div>"; }
}

export function radarChart(axes, values, opts) {
	try {
		const o = Object.assign({ size: 180, color: "#9ad8ff", fill: "rgba(154,216,255,0.2)", max: 100 }, opts || {});
		if (!axes || !values || axes.length !== values.length || axes.length < 3) return "";
		const cx = o.size / 2, cy = o.size / 2, r = o.size / 2 - 20;
		const n = axes.length;
		const angleAt = function (i) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; };
		let s = "<svg width='" + o.size + "' height='" + o.size + "' style='display:block;'>";
		[0.25, 0.5, 0.75, 1].forEach(function (f) {
			let poly = "";
			for (let i = 0; i < n; i++) {
				const a = angleAt(i);
				const x = cx + Math.cos(a) * r * f;
				const y = cy + Math.sin(a) * r * f;
				poly += (i === 0 ? "" : " ") + x.toFixed(1) + "," + y.toFixed(1);
			}
			s += "<polygon points='" + poly + "' fill='none' stroke='#1a2637' stroke-width='1'/>";
		});
		for (let i = 0; i < n; i++) {
			const a = angleAt(i);
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r;
			s += "<line x1='" + cx + "' y1='" + cy + "' x2='" + x.toFixed(1) + "' y2='" + y.toFixed(1) + "' stroke='#1a2637' stroke-width='1'/>";
		}
		let poly = "";
		for (let i = 0; i < n; i++) {
			const a = angleAt(i);
			const f = Math.max(0, Math.min(1, (values[i] || 0) / o.max));
			const x = cx + Math.cos(a) * r * f;
			const y = cy + Math.sin(a) * r * f;
			poly += (i === 0 ? "" : " ") + x.toFixed(1) + "," + y.toFixed(1);
		}
		s += "<polygon points='" + poly + "' fill='" + o.fill + "' stroke='" + o.color + "' stroke-width='2'/>";
		for (let i = 0; i < n; i++) {
			const a = angleAt(i);
			const lx = cx + Math.cos(a) * (r + 12);
			const ly = cy + Math.sin(a) * (r + 12);
			const anchor = lx < cx - 5 ? "end" : lx > cx + 5 ? "start" : "middle";
			s += "<text x='" + lx.toFixed(1) + "' y='" + (ly + 3).toFixed(1) + "' fill='#9ad8ff' font-size='9' text-anchor='" + anchor + "'>" + _esc(axes[i]) + "</text>";
		}
		s += "</svg>";
		return s;
	} catch (e) { return ""; }
}

export function donutChart(items, opts) {
	try {
		const o = Object.assign({ size: 120, thickness: 16, colors: ["#7fe3a0", "#ff9c9c", "#ffd479", "#9ad8ff", "#a8b8c8"] }, opts || {});
		if (!items || !items.length) return "";
		const total = items.reduce(function (s, it) { return s + (Number(it.value) || 0); }, 0) || 1;
		const cx = o.size / 2, cy = o.size / 2, r = o.size / 2 - o.thickness / 2;
		let acc = -Math.PI / 2;
		let s = "<svg width='" + o.size + "' height='" + o.size + "' style='display:block;'>";
		items.forEach(function (it, i) {
			const v = Number(it.value) || 0;
			const frac = v / total;
			const start = acc;
			const end = acc + frac * 2 * Math.PI;
			const x1 = cx + Math.cos(start) * r, y1 = cy + Math.sin(start) * r;
			const x2 = cx + Math.cos(end) * r, y2 = cy + Math.sin(end) * r;
			const largeArc = frac > 0.5 ? 1 : 0;
			const d = "M" + x1.toFixed(1) + "," + y1.toFixed(1) + " A" + r + "," + r + " 0 " + largeArc + " 1 " + x2.toFixed(1) + "," + y2.toFixed(1);
			const col = it.color || o.colors[i % o.colors.length];
			s += "<path d='" + d + "' fill='none' stroke='" + col + "' stroke-width='" + o.thickness + "'/>";
			acc = end;
		});
		s += "<text x='" + cx + "' y='" + (cy + 4) + "' fill='#dbe7f5' font-size='12' text-anchor='middle'>" + total + "</text>";
		s += "</svg>";
		return s;
	} catch (e) { return ""; }
}
