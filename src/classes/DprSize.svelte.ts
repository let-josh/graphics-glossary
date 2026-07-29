import { devicePixelRatio } from "svelte/reactivity/window";

export class DprSize {
	width: number;
	height: number;
	constructor(width = () => 1, height = () => 1) {
		this.width = $derived(Math.floor(width() * (devicePixelRatio.current ?? 1)));
		this.height = $derived(Math.floor(height() * (devicePixelRatio.current ?? 1)));
	}
}
