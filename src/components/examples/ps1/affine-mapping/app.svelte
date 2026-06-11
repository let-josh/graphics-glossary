<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/Addons.js";
	import {
		cameraProjectionMatrix,
		positionView,
		select,
		texture,
		uniform,
		uv,
		vertexStage,
	} from "three/tsl";

	const factor = 80;
	const w = 4;
	const h = 3;

	const camera = new t.PerspectiveCamera(60, w / h);
	const orbit = new OrbitControls(camera);

	const size = 16;

	$effect(() => {
		const oss = new OffscreenCanvas(size, size);
		const context = oss.getContext("2d");
		if (context === null) throw new Error("context is null");

		for (let j = 0; j < size; j += 1) {
			for (let i = 0; i < size; i += 1) {
				context.fillStyle = (i + j) % 2 === 0 ? "orange" : "purple";
				context.fillRect(i, j, 1, 1);
			}
		}
		const map = new t.CanvasTexture(oss);
		map.minFilter = map.magFilter = t.NearestFilter;
		map.generateMipmaps = false;

		colorNode.value = map;
	});

	const clip = cameraProjectionMatrix.mul(positionView);
	const affine = uniform(true);
	const colorNode = texture(
		new t.Texture(),
		select(affine, vertexStage(uv().mul(clip.w)).div(clip.w), uv()),
	);

	const mesh = new t.Mesh(
		new t.PlaneGeometry(),
		new t.MeshBasicNodeMaterial({
			colorNode,
		}),
	);

	fitCameraToObject(camera, mesh, {
		fudge: 1.25,
	});
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "uniforms",
			},
			(pane) => {
				pane.addBinding(affine, "value", {
					label: "affine",
				});
			},
		)}
	/>
	<canvas
		width={factor * w}
		height={factor * h}
		class="aspect-square md:aspect-video w-full"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				canvas,
			});

			const setAnimationLoop = renderer.setAnimationLoop((time) => {
				mesh.rotation.y = 0.5 * Math.sin((1 / 1000) * time);

				renderer.render(mesh, camera);
			});

			return () => {
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>

<style>
	canvas {
		image-rendering: pixelated;
	}
</style>
