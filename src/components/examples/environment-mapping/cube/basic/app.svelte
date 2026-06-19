<script
	module
	lang="ts"
>
	import negx from "@assets/cubemaps/Lycksele/negx.jpg";
	import negy from "@assets/cubemaps/Lycksele/negy.jpg";
	import negz from "@assets/cubemaps/Lycksele/negz.jpg";
	import posx from "@assets/cubemaps/Lycksele/posx.jpg";
	import posy from "@assets/cubemaps/Lycksele/posy.jpg";
	import posz from "@assets/cubemaps/Lycksele/posz.jpg";

	const loader = new t.CubeTextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const CAMERA_TRANSLATION_AMOUNT = 5;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

	const { promise: loadEnvironment, resolve } =
		Promise.withResolvers<t.CubeTexture>();

	$effect(() => {
		loader.loadAsync(cubeMapFiles).then(resolve);
	});

	const geometry = new t.IcosahedronGeometry(1, 0);
	const createMaterial = loadEnvironment.then(
		(envMap) =>
			new t.MeshBasicMaterial({
				envMap,
			}),
	);

	const createMesh = createMaterial.then(
		(material) => new t.Mesh(geometry, material),
	);

	const scene = new t.Scene();

	createMesh.then((mesh) => {
		scene.add(mesh);
	});

	loadEnvironment.then((background) => {
		scene.background = background;
	});

	const camera = new t.PerspectiveCamera().translateZ(
		CAMERA_TRANSLATION_AMOUNT,
	);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	onCleanup(() => {
		createMesh.then((mesh) => {
			scene.remove(mesh);
			mesh.geometry.dispose();
			mesh.material.map?.dispose();
			mesh.material.map = null;
			mesh.material.dispose();
		});

		loadEnvironment.then((texture) => {
			texture.dispose();
		});
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
