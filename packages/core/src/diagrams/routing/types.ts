import type { Point } from "../geometry";

export type PathCmd = { t: "M"; p: Point } | { t: "L"; p: Point } | { t: "C"; c1: Point; c2: Point; p: Point };
