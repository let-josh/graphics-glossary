<script
	lang="ts"
	module
>
	const cameraTranslationAxis = new Vector3(1, 0.5, 1).normalize();
	const cameraTranslationAmount = 5;
	const tau = 2 * Math.PI;

	const forwardsFrameCount = 18;

	/**
	 * number of frames to show during the last half of the rotation
	 * equal to `frameCount` minus the first and last *frames*
	 */
	const backwardsFrameCount = forwardsFrameCount - 2;

	const frameCount = forwardsFrameCount + backwardsFrameCount;

	const spriteWidth = booImageMetadata.width / forwardsFrameCount;

	/** the width of the image minus the width of the first and last sprites */
	const extensionWidth = booImageMetadata.width - 2 * spriteWidth;

	const yHat = new Vector3(0, 1, 0);

	const cameraRotationSpeed = (1 / 180) * Math.PI;
</script>

<script lang="ts">
	import booImageMetadata from "@assets/boo.png";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { loadImage } from "@functions/loadImage";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		BoxGeometry,
		CanvasTexture,
		Mesh,
		MeshNormalMaterial,
		NearestFilter,
		PerspectiveCamera,
		RepeatWrapping,
		Scene,
		Sprite,
		SpriteMaterial,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const booCanvas = new OffscreenCanvas(
		booImageMetadata.width + extensionWidth,
		booImageMetadata.height,
	);
	const booCanvasContext = booCanvas.getContext("2d");

	// the example can not work without the context so just throw and let the boundary handle it
	if (booCanvasContext === null) {
		throw new Error("texture context is null");
	}

	const canvasTexture = createDisposed(CanvasTexture, booCanvas);
	canvasTexture.minFilter = NearestFilter;
	canvasTexture.magFilter = NearestFilter;

	canvasTexture.generateMipmaps = false;

	canvasTexture.wrapS = RepeatWrapping;
	canvasTexture.wrapT = RepeatWrapping;
	canvasTexture.repeat.x = 1 / frameCount;

	loadImage(
		booImageMetadata.src,
		booImageMetadata.width,
		booImageMetadata.height,
	).then((image) => {
		booCanvasContext.drawImage(image, 0, 0);

		booCanvasContext.save();
		booCanvasContext.scale(-1, 1);

		// draw the image flipped but leave out the first and last sprites
		booCanvasContext.drawImage(
			image,
			spriteWidth,
			0,
			extensionWidth,
			image.height,
			-1 * image.width,
			0,
			-1 * extensionWidth,
			image.height,
		);
		booCanvasContext.restore();

		canvasTexture.needsUpdate = true;
	});

	const spriteMaterial = createDisposed(SpriteMaterial, {
		map: canvasTexture,
	});

	const sprite = new Sprite(spriteMaterial).translateZ(1);

	const material = createDisposed(MeshNormalMaterial);
	const geometry = createDisposed(BoxGeometry);

	const mesh = new Mesh(geometry, material).translateZ(-1);
	mesh.scale.setScalar(0.5);

	const scene = new Scene().add(sprite, mesh);

	const camera = new PerspectiveCamera().translateOnAxis(
		cameraTranslationAxis,
		cameraTranslationAmount,
	);

	let lastOffset: number;
</script>

<canvas
	class="aspect-square md:aspect-video"
	{@attach (canvas) => {
		const renderer = new WebGPURenderer({
			antialias: true,
			canvas,
		});

		const promise = renderer.setAnimationLoop(() => {
			if (resize(renderer)) {
				const aspect = canvas.clientWidth / canvas.clientHeight;
				setCameraAspect(camera, aspect);
			}

			camera.position.applyAxisAngle(yHat, cameraRotationSpeed);
			camera.lookAt(scene.position);

			let angle = camera.position.angleTo(sprite.position);

			// determine if the larger angle should be used
			const o =
				camera.position.x * sprite.position.z -
				camera.position.z * sprite.position.x;
			if (o < 0) angle = tau - angle;

			const offset = Math.floor(frameCount * (angle / tau));

			if (lastOffset !== offset) {
				canvasTexture.offset.x = offset / frameCount;
				lastOffset = offset;
			}

			renderer.render(scene, camera);
		});

		return () => {
			promise.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
