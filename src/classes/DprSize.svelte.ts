import { devicePixelRatio } from "svelte/reactivity/window";

export class DprSize {
	width: number;
	height: number;
	constructor(width = () => 1, height = () => 1) {
		this.width = $derived(width() * (devicePixelRatio.current ?? 1));
		this.height = $derived(height() * (devicePixelRatio.current ?? 1));
	}
}
