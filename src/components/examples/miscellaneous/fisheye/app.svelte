<script
	lang="ts"
	module
>
	import negx from "@assets/cubemaps/Lycksele/negx.jpg";
	import negy from "@assets/cubemaps/Lycksele/negy.jpg";
	import negz from "@assets/cubemaps/Lycksele/negz.jpg";
	import posx from "@assets/cubemaps/Lycksele/posx.jpg";
	import posy from "@assets/cubemaps/Lycksele/posy.jpg";
	import posz from "@assets/cubemaps/Lycksele/posz.jpg";

	const dracoLoader = new DRACOLoader().setDecoderPath(
		"https://www.gstatic.com/draco/v1/decoders/",
	);
	const gltfLoader = new GLTFLoader();
	gltfLoader.setDRACOLoader(dracoLoader);

	const cubeLoader = new CubeTextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const RESOLUTION = 1 << 10;

	const ZOOM = 100;

	const axis = new Vector3(1, 1, 1).normalize();
</script>

<script lang="ts">
	import gltfUrl from "@assets/gltfs/level-react-draco.glb";

	import { controls } from "@attachments/controls";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraPlanes } from "@functions/setCameraPlanes";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
	import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
	import {
		CubeCamera,
		CubeRenderTarget,
		CubeTextureLoader,
		Mesh,
		MeshBasicMaterial,
		OrthographicCamera,
		PerspectiveCamera,
		Scene,
		SphereGeometry,
		Vector2,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();
	gltfLoader.loadAsync(gltfUrl).then((gltf) => {
		scene.add(gltf.scene);
	});

	const cubeEnvironmentTexture = cubeLoader
		.loadAsync(cubeMapFiles)
		.then((texture) => {
			const last = scene.environment;
			scene.environment = texture;
			return () => {
				scene.environment = last;
				texture.dispose();
			};
		});

	const orthoCamera = new OrthographicCamera().translateZ(ZOOM);
	orthoCamera.zoom = ZOOM;

	const renderTarget = new CubeRenderTarget(RESOLUTION);

	const cubeCamera = new CubeCamera(
		orthoCamera.near,
		orthoCamera.far,
		renderTarget,
	);

	const geometry = new SphereGeometry();
	const material = new MeshBasicMaterial({
		envMap: renderTarget.texture,
	});
	const sphere = new Mesh(geometry, material);

	const rendererSize = new Vector2();

	const dummyCamera = new PerspectiveCamera().translateOnAxis(axis, 1);
	const orbit = new OrbitControls(dummyCamera);

	onCleanup(() => {
		renderTarget.dispose();
		geometry.dispose();
		material.dispose();
		cubeEnvironmentTexture.then((cleanup) => {
			cleanup();
		});
	});
</script>

<canvas
	class="aspect-square"
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const setAnimationLoopPromise = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				renderer.getSize(rendererSize);
				setCameraPlanes(orthoCamera, rendererSize.width, rendererSize.height);

				const radius = 0.5 * (Math.hypot(...rendererSize) / orthoCamera.zoom);
				sphere.scale.setScalar(radius);
			}
			cubeCamera.position.copy(dummyCamera.position);
			cubeCamera.lookAt(orbit.target);

			cubeCamera.update(renderer, scene);

			renderer.render(sphere, orthoCamera);
		});

		return () => {
			setAnimationLoopPromise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
