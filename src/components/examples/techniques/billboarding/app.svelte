<script
	lang="ts"
	module
>
	const countRegex = /(?<count>\d+).\w+/;
	const textureLoader = new TextureLoader();
</script>

<script lang="ts">
	import abaloneSpriteSheetUrl from "@assets/abalone-spritesheet-16.png";

	import { controls } from "@attachments/controls";

	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import { texture, uniform, uv, vec2 } from "three/tsl";
	import {
		BoxGeometry,
		Mesh,
		MeshNormalMaterial,
		PerspectiveCamera,
		Scene,
		Sprite,
		SpriteNodeMaterial,
		TextureLoader,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const loadSpriteSheet = textureLoader.loadAsync(abaloneSpriteSheetUrl.src);

	const geometry = new BoxGeometry();
	const material = new MeshNormalMaterial();

	const box = new Mesh(geometry, material).translateX(1);
	box.scale.setScalar(0.5);

	const matches = abaloneSpriteSheetUrl.src.match(countRegex);

	const count = +(matches?.groups?.count ?? 1);

	const offset = uniform(0);
	const w = 1 / count;

	const mainScene = new Scene().add(box);

	const axis = new Vector3(0, 0.5, 1).normalize();
	const mainCamera = new PerspectiveCamera().translateOnAxis(axis, 3);
	mainCamera.lookAt(mainScene.position);

	$effect(() => {
		return () => {
			geometry.dispose();
			material.dispose();
		};
	});

	const orbit = new OrbitControls(mainCamera);
	orbit.autoRotate = true;

	orbit.addEventListener("change", () => {
		let angle =
			Math.atan2(mainCamera.position.z, mainCamera.position.x) - 0.5 * Math.PI;
		if (angle < 0) angle += 2 * Math.PI;

		angle /= 2 * Math.PI;
		angle *= count;
		angle = count - Math.floor(angle) - 1;

		offset.value = angle;
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

		const addSprite = loadSpriteSheet.then((t) => {
			t.colorSpace = renderer.currentColorSpace;
			const spriteMaterial = new SpriteNodeMaterial({
				colorNode: texture(
					t,
					uv()
						.mul(vec2(w, 1))
						.add(vec2(offset.mul(w), 0)),
				),
			});
			const sprite = new Sprite(spriteMaterial).translateX(-1);
			mainScene.add(sprite);
			return () => {
				mainScene.remove(sprite);
				spriteMaterial.dispose();
			};
		});

		const beginLoop = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(mainCamera, aspect);
			}
			orbit.update();
			renderer.render(mainScene, mainCamera);
		});

		return () => {
			addSprite.then((cleanup) => {
				cleanup();
			});
			beginLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
