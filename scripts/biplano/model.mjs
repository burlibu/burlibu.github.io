// Full-scale flight model of a two-seat training biplane (de Havilland Tiger Moth class).
// Pure and DOM-free: the build reads the dial marks from it, the page inlines it.
export const MODEL = (() => {
  const m = 828; // kg, maximum take-off mass
  const g = 9.81;
  const S = 22.2; // m², both wings
  const rho = 1.225; // kg/m³, sea level
  const clAlpha = 0.077; // per degree, finite biplane wing with gap interference
  const alpha0 = -2; // zero-lift angle of a cambered section, degrees
  const alphaStall = 14;
  const clMax = clAlpha * (alphaStall - alpha0);
  const W = m * g;
  return {
    m, g, S, rho, W, clAlpha, alpha0, alphaStall, clMax,
    power: 97000, // W, 130 hp engine
    eta: 0.75, // propeller efficiency in climb and cruise
    staticThrust: 2400, // N at full throttle, standing still
    cd0: 0.042, // parasite drag: struts, wires, open cockpits, fixed gear
    kInduced: 1 / (Math.PI * 0.75 * 5), // CL² / (π e AR), AR 5 for the box of two wings
    rpmIdle: 650,
    rpmMax: 2350,
    vneKmh: 257,
    vStallKmh: Math.sqrt((2 * W) / (rho * S * clMax)) * 3.6,
  };
})();

export const liftCoefficient = (alpha) => {
  const { clAlpha, alpha0, alphaStall, clMax } = MODEL;
  if (alpha <= alphaStall) return clAlpha * (alpha - alpha0);
  return clMax * Math.max(0.55, 1 - 0.07 * (alpha - alphaStall)); // the flow separates from the upper surface
};

// The stick holds an angle of attack; the aircraft settles at the speed where that angle
// lifts its weight. The throttle then decides whether it climbs or descends.
export function flight(alpha, throttle) {
  const { W, S, rho, cd0, kInduced, clMax, alphaStall, power, eta, staticThrust, rpmIdle, rpmMax } = MODEL;
  const cl = liftCoefficient(alpha);
  const stalled = alpha > alphaStall;
  const v = Math.sqrt((2 * W) / (rho * S * (stalled ? clMax : cl)));
  const q = 0.5 * rho * v * v;
  const lift = q * S * cl;
  const cd = cd0 + kInduced * cl * cl + (stalled ? 0.06 * (alpha - alphaStall) : 0);
  const drag = q * S * cd;
  const thrust = throttle * Math.min(staticThrust, (eta * power) / v);
  // excess power climbs; a lift deficit tips the path down until L = W cos γ
  const sink = lift < W ? v * Math.sin(Math.acos(lift / W)) : 0;
  const climb = ((thrust - drag) * v) / W - sink;
  const rpm = Math.min(rpmMax, rpmIdle + (rpmMax - rpmIdle) * throttle * (0.82 + 0.18 * Math.min(1, v / 50)));
  return { cl, v, kmh: v * 3.6, lift, drag, thrust, climb, stalled, rpm, ratio: lift / W };
}
