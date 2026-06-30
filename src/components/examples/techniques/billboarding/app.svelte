<script
	lang="ts"
	module
>
	const countRegex = /(?<count>\d+).\w+/;
	const textureLoader = new t.TextureLoader();
</script>

<script lang="ts">
	import abaloneSpriteSheetUrl from "@assets/abalone-spritesheet-16.png";

	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/addons";
	import { texture, uniform, uv, vec2 } from "three/tsl";

	const { promise: loadSpriteSheet, resolve } =
		Promise.withResolvers<t.Texture>();

	$effect(() => {
		textureLoader.loadAsync(abaloneSpriteSheetUrl.src).then(resolve);
	});

	const geometry = new t.BoxGeometry();
	const material = new t.MeshNormalMaterial();

	const box = new t.Mesh(geometry, material).translateX(1);
	box.scale.setScalar(0.5);

	const matches = abaloneSpriteSheetUrl.src.match(countRegex);

	const count = +(matches?.groups?.count ?? 1);

	const offset = uniform(0);
	const w = 1 / count;

	const mainScene = new t.Scene().add(box);

	const axis = new t.Vector3(0, 0.5, 1).normalize();
	const camera = new t.PerspectiveCamera().translateOnAxis(axis, 3);
	camera.lookAt(mainScene.position);

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	orbit.addEventListener("change", () => {
		let angle =
			Math.atan2(camera.position.z, camera.position.x) - 0.5 * Math.PI;
		if (angle < 0) angle += 2 * Math.PI;

		angle /= 2 * Math.PI;
		angle *= count;
		angle = count - Math.floor(angle) - 1;

		offset.value = angle;
	});

	const createSpriteMaterial = loadSpriteSheet.then(
		(sheet) =>
			new t.SpriteNodeMaterial({
				colorNode: texture(
					sheet,
					uv()
						.mul(vec2(w, 1))
						.add(vec2(offset.mul(w), 0)),
				),
			}),
	);

	const createSprite = createSpriteMaterial.then((material) =>
		new t.Sprite(material).translateX(-1),
	);

	const addSpriteToScene = createSprite.then((sprite) => {
		mainScene.add(sprite);
		return () => {
			mainScene.remove(sprite);
		};
	});

	onCleanup(() => {
		addSpriteToScene.then((removeSprite) => {
			removeSprite();
		});
		geometry.dispose();
		material.dispose();
	});

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);
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

		$effect(() => {
			renderer.setSize(rendererSize.width, rendererSize.height, false);
		});

		loadSpriteSheet.then((sheet) => {
			sheet.colorSpace = renderer.currentColorSpace;
		});

		const setAnimationLoop = renderer.setAnimationLoop(() => {
			orbit.update();
			renderer.render(mainScene, camera);
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
