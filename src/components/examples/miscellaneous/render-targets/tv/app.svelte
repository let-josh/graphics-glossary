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
	import tvGltfUrl from "@assets/gltfs/tv.glb";

	const cubeLoader = new t.CubeTextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);

	const screenMeshName = "Mesh_televisionModern_1";

	const CONSTRAINT_FACTOR = 1000;

	const RENDER_TARGET_CAMERA_TRANSLATION_AMOUNT = 3;
	const CAMERA_TRANSLATION_AMOUNT = 1;
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { boxFromIndexedPositionAttribute } from "@functions/boxFromIndexedPositionAttribute";
	import { isMesh } from "@functions/isMesh";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import { GLTFLoader, OrbitControls } from "three/examples/jsm/Addons.js";

	const { promise: loadGLTF, resolve: resolveGLTF } =
		Promise.withResolvers<Awaited<ReturnType<GLTFLoader["loadAsync"]>>>();
	const { promise: loadEnvironment, resolve: resolveEnvironment } =
		Promise.withResolvers<t.CubeTexture>();

	$effect(() => {
		gltfLoader.loadAsync(tvGltfUrl).then(resolveGLTF);
		cubeLoader.loadAsync(cubeMapFiles).then(resolveEnvironment);
	});

	const scene = new t.Scene();
	loadGLTF.then((gltf) => {
		scene.add(gltf.scene);
	});

	const getScreenMesh = loadGLTF.then((gltf) => {
		const object = gltf.scene.getObjectByName(screenMeshName);
		if (!isMesh(object)) return null;
		object.visible = false;
		return object;
	});

	const createBox = getScreenMesh.then((mesh) => {
		if (mesh === null) return mesh;
		const index = mesh.geometry.getIndex();
		if (index === null) return index;
		const positionAttribute = mesh.geometry.getAttribute("position");
		return boxFromIndexedPositionAttribute(index, positionAttribute);
	});

	loadEnvironment.then((environment) => {
		scene.environment = scene.background = environment;
	});

	const axis = new t.Vector3(0, 0.5, 1).normalize();
	const camera = new t.PerspectiveCamera().translateOnAxis(
		axis,
		CAMERA_TRANSLATION_AMOUNT,
	);
	const orbit = new OrbitControls(camera);

	const centerOrbitTarget = createBox.then((box) => {
		box?.getCenter(orbit.target);
	});

	const createSize = createBox.then((box) => {
		const size = new t.Vector3();
		box?.getSize(size);
		return size;
	});

	const createStream = createSize.then((size) => {
		return navigator.mediaDevices.getUserMedia({
			video: {
				width: Math.floor(CONSTRAINT_FACTOR * size.x),
				height: Math.floor(CONSTRAINT_FACTOR * size.y),
				facingMode: "user",
			},
		});
	});

	const createScreenGeometry = createSize.then(
		(size) => new t.PlaneGeometry(size.x, size.y),
	);

	const createScreenMesh = createScreenGeometry.then(
		(geometry) => new t.Mesh(geometry, screenMaterial),
	);

	Promise.all([createScreenMesh, centerOrbitTarget]).then(([mesh]) => {
		mesh.position.copy(orbit.target);
	});

	const addScreenMesh = createScreenMesh.then((mesh) => {
		scene.add(mesh);
		return (cleanup: (mesh: t.Mesh) => void) => {
			scene.remove(mesh);
			cleanup(mesh);
		};
	});

	const renderTarget = new t.RenderTarget();
	const screenMaterial = new t.MeshBasicMaterial({
		map: renderTarget.texture,
	});

	const renderTargetScene = new t.Scene();

	const renderTargetCamera = new t.PerspectiveCamera().translateOnAxis(
		axis.set(0, -1 * 0.5, 1).normalize(),
		RENDER_TARGET_CAMERA_TRANSLATION_AMOUNT,
	);
	renderTargetCamera.lookAt(renderTargetScene.position);

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	$effect(() => {
		renderTarget.setSize(rendererSize.width, rendererSize.height);
	});

	onCleanup(() => {
		renderTarget.dispose();
		addScreenMesh.then((cleanup) => {
			cleanup((mesh) => {
				mesh.geometry.dispose();
				const materials = Array.isArray(mesh.material)
					? mesh.material
					: [mesh.material];
				for (const material of materials) material.dispose();
			});
		});
	});
</script>

<video
	class="hidden"
	{@attach (video) => {
		const videoSrcSet = createStream.then((stream) => {
			const geometry = new t.BoxGeometry();

			const videoTexture = new t.VideoTexture(video);
			videoTexture.flipY = false;
			videoTexture.colorSpace = t.SRGBColorSpace;
			const material = new t.MeshBasicMaterial({
				map: videoTexture,
			});
			const mesh = new t.Mesh(geometry, material);
			renderTargetScene.add(mesh);
			const lastSrcObject = video.srcObject;
			video.srcObject = stream;
			video.play();
			return () => {
				renderTargetScene.remove(mesh);
				videoTexture.dispose();
				geometry.dispose();
				material.dispose();

				video.pause();
				video.srcObject = lastSrcObject;
			};
		});

		return () => {
			videoSrcSet.then((cleanup) => {
				cleanup();
			});
		};
	}}
>
</video>
<div class="relative">
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

			const setAnimationLoopPromise = renderer.setAnimationLoop(() => {
				renderTargetScene.rotateY((1 / 240) * Math.PI);

				const last = renderer.getRenderTarget();

				renderer.setRenderTarget(renderTarget);
				renderer.render(renderTargetScene, renderTargetCamera);

				renderer.setRenderTarget(last);
				renderer.render(scene, camera);
			});

			return () => {
				setAnimationLoopPromise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
	<p class="absolute bottom-2 right-2">
		tv model by <a href="https://kenney.nl">kenney</a>
	</p>
</div>
