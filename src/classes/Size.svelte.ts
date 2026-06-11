export class Size {
	width = $state(0);
	height = $state(1);
	ratio = $derived(this.width / this.height);
}
