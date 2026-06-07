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

	const loader = new CubeTextureLoader();

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

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import {
		CubeTextureLoader,
		IcosahedronGeometry,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		Scene,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();

	const texture = await loader.loadAsync(cubeMapFiles);
	onCleanup(() => {
		texture.dispose();
	});

	scene.background = texture;

	const geometry = createDisposed(IcosahedronGeometry, 1, 0);
	const material = createDisposed(MeshBasicMaterial, {
		envMap: texture,
	});
	const mesh = new Mesh(geometry, material);

	scene.add(mesh);

	const camera = new PerspectiveCamera().translateZ(CAMERA_TRANSLATION_AMOUNT);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
</script>

<canvas
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);
			}

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
