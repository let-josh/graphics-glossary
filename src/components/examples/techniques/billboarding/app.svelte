<script
	lang="ts"
	module
>
	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { loadAbalone } from "@functions/loadAbalone";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { GLTFLoader, RoomEnvironment } from "three/examples/jsm/Addons.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";
	import {
		Box3,
		PMREMGenerator,
		PerspectiveCamera,
		RenderTarget,
		Scene,
		Sprite,
		SpriteMaterial,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const abalonePromise = loadAbalone(gltfLoader);

	const mainScene = new Scene();

	const axis = new Vector3(1, 1, 1).normalize();
	const mainCamera = new PerspectiveCamera().translateOnAxis(axis, 1);
	mainCamera.lookAt(mainScene.position);
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const loopPromise = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(mainCamera, aspect);
			}
			renderer.render(mainScene, mainCamera);
		});

		const envMapPromise = loopPromise.then(() => {
			const environment = new RoomEnvironment();
			const pmremGenerator = new PMREMGenerator(renderer);
			const envMap = pmremGenerator.fromScene(environment).texture;

			environment.dispose();
			pmremGenerator.dispose();

			return envMap;
		});

		const renderTargetPromise = Promise.all([
			envMapPromise,
			abalonePromise,
		]).then(([envMap, gltf]) => {
			const scene = new Scene().add(gltf.scene);
			scene.environment = envMap;

			const box = new Box3().setFromObject(gltf.scene);

			const boxSize = box.getSize(new Vector3());
			const size = 1.3 * Math.max(...boxSize);

			const fov = 60;

			const m = 100;
			const near = (1 / m) * size;
			const far = m * size;

			const distance = (0.5 * size) / Math.tan(DEG2RAD * 0.5 * fov);
			const camera = new PerspectiveCamera(fov, 1, near, far).translateZ(
				distance,
			);

			const rtSize = 256;
			const target = new RenderTarget(rtSize, rtSize, { flipY: false });

			const lastRenderTarget = renderer.getRenderTarget();
			renderer.setRenderTarget(target);
			renderer.render(scene, camera);
			renderer.setRenderTarget(lastRenderTarget);

			return target;
		});

		const scenePromise = renderTargetPromise.then((target) => {
			const material = new SpriteMaterial({
				map: target.texture,
			});
			const sprite = new Sprite(material);
			mainScene.add(sprite);
			return () => {
				mainScene.remove(sprite);
				material.dispose();
				target.dispose();
			};
		});

		return () => {
			loopPromise.then(() => {
				renderer.dispose();
			});

			scenePromise.then((cleanup) => {
				cleanup();
			});
		};
	}}
>
</canvas>
