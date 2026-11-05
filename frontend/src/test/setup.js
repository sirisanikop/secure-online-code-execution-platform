import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); sessionStorage.clear(); });

// jsdom lacks these browser APIs that CodeMirror touches
if (!document.createRange) document.createRange = () => ({ setStart() {}, setEnd() {}, getBoundingClientRect: () => ({}), getClientRects: () => [] });
window.Range.prototype.getClientRects = window.Range.prototype.getClientRects || (() => []);
window.Range.prototype.getBoundingClientRect = window.Range.prototype.getBoundingClientRect || (() => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }));
