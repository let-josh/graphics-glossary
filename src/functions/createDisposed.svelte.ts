import { onCleanup } from "./onCleanup.svelte";

/**
 * things which require disposal in three.js have a `dispose` method on them.
 *
 * this function automatically calls `.dispose` on cleanup.
 *
 * must be called within an effect such as $effect.root or component initialization
 * creates an instance of `constructor` and calls its `dispose` method when the parent effect is destroyed

 * @example
 *
 * ```ts
 * const geometry = createDisposed(MeshBasicMaterial, { color: 'yellow' });
 * ```
 */
export const createDisposed = <
	Disposable extends {
		dispose(): void;
	},
	Args extends unknown[],
>(
	constructor: new (...args: Args) => Disposable,
	...args: NoInfer<Args>
): Disposable => {
	const disposable = new constructor(...args);

	onCleanup(() => {
		disposable.dispose();
	});

	return disposable;
};
