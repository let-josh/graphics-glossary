<script
	module
	lang="ts"
>
	import backgroundTextureUrl from "@assets/equirect/suburban_garden.png";

	const loader = new t.TextureLoader();
	const CAMERA_TRANSLATION_AMOUNT = 1;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { equirectUV, texture } from "three/tsl";

	const { promise: loadBackground, resolve } =
		Promise.withResolvers<t.Texture>();

	$effect(() => {
		loader.loadAsync(backgroundTextureUrl.src).then(resolve);
	});

	const scene = new t.Scene();

	loadBackground.then((background) => {
		scene.backgroundNode = texture(background, equirectUV());
	});

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	const camera = new t.PerspectiveCamera().translateZ(
		CAMERA_TRANSLATION_AMOUNT,
	);
	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

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

		loadBackground.then((background) => {
			background.colorSpace = renderer.currentColorSpace;
		});

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			orbit.update();
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
