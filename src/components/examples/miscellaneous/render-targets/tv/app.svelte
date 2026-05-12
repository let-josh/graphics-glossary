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
	import tvGltfUrl from "@assets/gltfs/kenney/tv.glb";

	const cubeLoader = new CubeTextureLoader();

	const cubeMapFiles = [
		posx.src,
		negx.src,
		posy.src,
		negy.src,
		posz.src,
		negz.src,
	] as const;

	const gltfLoader = new GLTFLoader();

	const screenMeshName = "Mesh_televisionModern_1";

	const CONSTRAINT_FACTOR = 1000;

	const isMesh = (m: any): m is Mesh => m?.isMesh === true;

	const rendererSize = new Vector2();

	const size = new Vector3();

	const RENDER_TARGET_CAMERA_TRANSLATION_AMOUNT = 3;
	const CAMERA_TRANSLATION_AMOUNT = 1;
</script>

<script>
	import { controls } from "@attachments/controls";

	import { boxFromIndexedPositionAttribute } from "@functions/boxFromIndexedPositionAttribute";
	import { createDisposed } from "@functions/createDisposed.svelte";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { GLTFLoader, OrbitControls } from "three/examples/jsm/Addons.js";
	import {
		BoxGeometry,
		CubeTextureLoader,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		PlaneGeometry,
		RenderTarget,
		SRGBColorSpace,
		Scene,
		Texture,
		Vector2,
		Vector3,
		VideoTexture,
		WebGPURenderer,
	} from "three/webgpu";

	const [tvGltf, environment] = await Promise.all([
		gltfLoader.loadAsync(tvGltfUrl),
		cubeLoader.loadAsync(cubeMapFiles),
	]);

	const screenMesh = tvGltf.scene.getObjectByName(screenMeshName);

	if (!isMesh(screenMesh)) {
		throw new Error("screen mesh is not an instance of `Mesh`");
	}

	const index = screenMesh.geometry.getIndex();
	if (index === null) {
		throw new Error("expected screen mesh geometry to be indexed");
	}

	screenMesh.visible = false;

	onCleanup(() => {
		environment.dispose();
	});

	const scene = new Scene().add(tvGltf.scene);
	scene.environment = scene.background = environment;

	const positionAttribute = screenMesh.geometry.getAttribute("position");

	const axis = new Vector3(0, 0.5, 1).normalize();
	const camera = new PerspectiveCamera().translateOnAxis(
		axis,
		CAMERA_TRANSLATION_AMOUNT,
	);
	const orbit = new OrbitControls(camera);

	const box = boxFromIndexedPositionAttribute(index, positionAttribute);
	box.getCenter(orbit.target);
	orbit.update();

	box.getSize(size);

	const streamPromise = navigator.mediaDevices.getUserMedia({
		video: {
			width: Math.floor(CONSTRAINT_FACTOR * size.x),
			height: Math.floor(CONSTRAINT_FACTOR * size.y),
			facingMode: "user",
		},
	});

	const screenGeometry = createDisposed(PlaneGeometry, size.x, size.y);

	const renderTarget = createDisposed(RenderTarget);
	const screenMaterial = createDisposed(MeshBasicMaterial, {
		map: renderTarget.texture,
	});
	const plane = new Mesh(screenGeometry, screenMaterial);
	plane.position.copy(orbit.target);
	scene.add(plane);

	const geometry = createDisposed(BoxGeometry);

	const dummyTexture = createDisposed(Texture);
	const material = createDisposed(MeshBasicMaterial, {
		map: dummyTexture,
	});

	const mesh = new Mesh(geometry, material);
	const renderTargetScene = new Scene().add(mesh);

	const renderTargetCamera = new PerspectiveCamera().translateOnAxis(
		axis.set(0, -1 * 0.5, 1).normalize(),
		RENDER_TARGET_CAMERA_TRANSLATION_AMOUNT,
	);
	renderTargetCamera.lookAt(renderTargetScene.position);
</script>

<video
	class="hidden"
	{@attach (video) => {
		const videoTexture = new VideoTexture(video);
		videoTexture.flipY = false;
		videoTexture.colorSpace = SRGBColorSpace;

		const videoSrcSet = streamPromise.then((stream) => {
			const lastMap = material.map;
			material.map = videoTexture;
			const lastSrcObject = video.srcObject;
			video.srcObject = stream;
			video.play();
			return () => {
				material.map = lastMap;
				video.pause();
				video.srcObject = lastSrcObject;
				videoTexture.dispose();
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
		class="aspect-square md:md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const setAnimationLoopPromise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
					renderer.getSize(rendererSize);
					renderTarget.setSize(rendererSize.width, rendererSize.height);
				}

				mesh.rotateY((1 / 240) * Math.PI);

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
