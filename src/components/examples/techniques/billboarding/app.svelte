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

	const rtSize = 512;
	const count = 16;
	const target = new RenderTarget(count * rtSize, rtSize, {
		magFilter: NearestFilter,
		minFilter: NearestFilter,
	});

	target.texture.repeat.x = 1 / count;

	const spriteMaterial = new SpriteMaterial({
		map: target.texture,
	});
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

	let lastAngle: number;
	orbit.addEventListener("change", () => {
		let angle =
			Math.atan2(mainCamera.position.z, mainCamera.position.x) - 0.5 * Math.PI;
		if (angle < 0) angle += 2 * Math.PI;
		angle /= 2 * Math.PI;
		angle *= count;
		angle = Math.floor(angle);

		if (lastAngle !== angle) {
			lastAngle = angle;
			target.texture.offset.x = (1 - angle / count) % 1;
		}
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
			const size = 1.25 * Math.max(...boxSize);

			const fov = 60;

			const m = 100;
			const near = (1 / m) * size;
			const far = m * size;

			const distance = (0.5 * size) / Math.tan(DEG2RAD * 0.5 * fov);

			const cameras: PerspectiveCamera[] = [];
			const a = (2 * Math.PI) / count;
			const yHat = new Vector3(0, 1, 0);
			for (let i = 0; i < count; i += 1) {
				const camera = new PerspectiveCamera(fov, 1, near, far).translateZ(
					distance,
				);
				const angle = a * i;
				camera.viewport = new Vector4(i * rtSize, 0, rtSize, rtSize);
				camera.updateProjectionMatrix();

				camera.position.applyAxisAngle(yHat, angle);
				camera.lookAt(gltf.scene.position);
				camera.updateMatrixWorld();

				cameras.push(camera);
			}

			const camera = new ArrayCamera(cameras);

			const lastTarget = renderer.getRenderTarget();

			const scene = new Scene().add(gltf.scene);
			scene.environment = envMap;

			renderer.setRenderTarget(target);

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
