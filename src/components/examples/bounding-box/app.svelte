<script
	module
	lang="ts"
>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import { GLTFLoader, OrbitControls } from "three/addons";

	const canvasSize = new Size();

	const camera = new t.PerspectiveCamera();

	const orbit = new OrbitControls(camera);

	const scene = new t.Scene();

	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});
</script>

<canvas
	bind:clientWidth={canvasSize.width}
	bind:clientHeight={canvasSize.height}
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new t.WebGPURenderer({
			antialias: true,
			canvas,
		});

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			renderer.render(scene, camera);
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
