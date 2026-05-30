<script
	lang="ts"
	module
>
	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { loadAbalone } from "@functions/loadAbalone";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		GLTFLoader,
		OrbitControls,
		RoomEnvironment,
	} from "three/examples/jsm/Addons.js";
	import { DEG2RAD } from "three/src/math/MathUtils.js";
	import {
		ArrayCamera,
		Box3,
		BoxGeometry,
		Mesh,
		MeshNormalMaterial,
		NearestFilter,
		PMREMGenerator,
		PerspectiveCamera,
		RenderTarget,
		Scene,
		Sprite,
		SpriteMaterial,
		Vector3,
		Vector4,
		WebGPURenderer,
	} from "three/webgpu";

	const abalonePromise = loadAbalone(gltfLoader);

	const geometry = new BoxGeometry();
	const material = new MeshNormalMaterial();

	const box = new Mesh(geometry, material).translateX(1);
	box.scale.setScalar(0.5);

	const rtSize = 128;
	const count = 16;
	const target = new RenderTarget(count * rtSize, rtSize, {
		magFilter: NearestFilter,
		minFilter: NearestFilter,
	});

	const spriteMaterial = new SpriteMaterial({ map: target.texture });
	const sprite = new Sprite(spriteMaterial).translateX(-1);

	const mainScene = new Scene().add(box, sprite);

	const axis = new Vector3(0, 0.5, 1).normalize();
	const mainCamera = new PerspectiveCamera().translateOnAxis(axis, 3);
	mainCamera.lookAt(mainScene.position);

	$effect(() => {
		return () => {
			geometry.dispose();
			material.dispose();
			target.dispose();
		};
	});

	const orbit = new OrbitControls(mainCamera);
	orbit.autoRotate = true;
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach controls(orbit)}
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
			orbit.update();
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

		Promise.all([envMapPromise, abalonePromise]).then(([envMap, gltf]) => {
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

			const lastTarget = renderer.getRenderTarget();

			renderer.setRenderTarget(target);

			const scene = new Scene().add(gltf.scene);
			scene.environment = envMap;
			renderer.render(scene, camera);

			renderer.setRenderTarget(lastTarget);
		});
		return () => {
			loopPromise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
