<script
	lang="ts"
	module
>
	const dracoLoader = new DRACOLoader().setDecoderPath(
		"https://www.gstatic.com/draco/v1/decoders/",
	);
	const gltfLoader = new GLTFLoader();
	gltfLoader.setDRACOLoader(dracoLoader);

	const RESOLUTION = 1 << 9;

	const ZOOM = 100;

	const axis = new Vector3(1, 1, 1).normalize();
</script>

<script lang="ts">
	import gltfUrl from "@assets/gltfs/level-react-draco.glb";

	import { controls } from "@attachments/controls";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraPlanes } from "@functions/setCameraPlanes";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
	import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
	import {
		CubeCamera,
		CubeRenderTarget,
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

	const orthoCamera = new OrthographicCamera().translateZ(ZOOM);
	orthoCamera.zoom = ZOOM;

	const renderTarget = createDisposed(CubeRenderTarget, RESOLUTION);

	const cubeCamera = new CubeCamera(
		orthoCamera.near,
		orthoCamera.far,
		renderTarget,
	);

	const geometry = createDisposed(SphereGeometry);
	const material = createDisposed(MeshBasicMaterial, {
		envMap: renderTarget.texture,
	});
	const sphere = new Mesh(geometry, material);

	const rendererSize = new Vector2();

	const dummyCamera = new PerspectiveCamera().translateOnAxis(axis, 1.5);
	const orbit = new OrbitControls(dummyCamera);

	onCleanup(() => {
		renderTarget.dispose();
		geometry.dispose();
		material.dispose();
	});
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach controls(orbit)}
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const setAnimationLoopPromise = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				renderer.getSize(rendererSize).multiplyScalar(0.5);
				setCameraPlanes(orthoCamera, rendererSize.width, rendererSize.height);

				const radius = Math.hypot(...rendererSize) / orthoCamera.zoom;
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
