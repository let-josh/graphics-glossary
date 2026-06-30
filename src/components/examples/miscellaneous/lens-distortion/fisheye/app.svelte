<script
	lang="ts"
	module
>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);

	const RESOLUTION = 1 << 9;

	const ZOOM = 100;

	const axis = new t.Vector3(1, 1, 1).normalize();
</script>

<script lang="ts">
	import gltfUrl from "@assets/gltfs/level-react-draco.glb";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraPlanes } from "@functions/setCameraPlanes";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import { GLTFLoader, OrbitControls } from "three/addons";

	const scene = new t.Scene();
	$effect(() => {
		gltfLoader.loadAsync(gltfUrl).then((gltf) => {
			scene.add(gltf.scene);
		});
	});

	const orthoCamera = new t.OrthographicCamera().translateZ(ZOOM);
	orthoCamera.zoom = ZOOM;

	const renderTarget = new t.CubeRenderTarget(RESOLUTION);

	const cubeCamera = new t.CubeCamera(
		orthoCamera.near,
		orthoCamera.far,
		renderTarget,
	);

	const geometry = new t.SphereGeometry();
	const material = new t.MeshBasicMaterial({
		envMap: renderTarget.texture,
	});
	const sphere = new t.Mesh(geometry, material);

	const dummyCamera = new t.PerspectiveCamera().translateOnAxis(axis, 1.5);
	const orbit = new OrbitControls(dummyCamera);

	onCleanup(() => {
		geometry.dispose();
		material.dispose();
		renderTarget.dispose();
	});

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraPlanes(orthoCamera, rendererSize.width, rendererSize.height);
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

		const v = new t.Vector2();

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
			const radius = renderer.getSize(v).length() / orthoCamera.zoom;
			sphere.scale.setScalar(radius);
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			cubeCamera.position.copy(dummyCamera.position);
			cubeCamera.lookAt(orbit.target);

			cubeCamera.update(renderer, scene);

			renderer.render(sphere, orthoCamera);
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
