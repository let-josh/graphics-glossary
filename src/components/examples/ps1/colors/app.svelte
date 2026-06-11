<script module>
	const dither = Fn(() => {
		const values = [-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2].map(
			(v) => float(v),
		);
		const uv = uvec2(screenCoordinate).mod(4);
		return array(values).element(uv.y.mul(4).add(uv.x));
	});
</script>

<script lang="ts">
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";

	import * as t from "three/webgpu";
	import {
		Fn,
		array,
		float,
		pass,
		screenCoordinate,
		select,
		texture,
		uniform,
		uvec2,
	} from "three/tsl";

	const factor = 80;
	const w = 4;
	const h = 3;

	const camera = new t.PerspectiveCamera(60, w / h);

	$effect(() => {
		const size = 256;
		const oss = new OffscreenCanvas(size, size);
		const context = oss.getContext("2d");
		if (context === null) throw new Error("context is null");

		const halfSize = size / 2;

		const gradient = context.createRadialGradient(
			halfSize,
			halfSize,
			0,
			halfSize,
			halfSize,
			Math.hypot(halfSize, halfSize),
		);

		gradient.addColorStop(0, "orange");
		gradient.addColorStop(1, "purple");

		context.fillStyle = gradient;
		context.fillRect(0, 0, size, size);

		const map = new t.CanvasTexture(oss);
		map.minFilter = map.magFilter = t.NearestFilter;
		map.generateMipmaps = false;

		colorNode.value = map;
	});

	const colorNode = texture();

	const mesh = new t.Mesh(
		new t.PlaneGeometry(),
		new t.MeshBasicNodeMaterial({
			colorNode,
		}),
	);

	const scene = new t.Scene().add(mesh);

	fitCameraToObject(camera, mesh, {
		fudge: 1.25,
	});

	const ditherEnabled = uniform(false);
	const quantizationEnabled = uniform(true);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "uniforms",
			},
			(pane) => {
				const quantizationBinding = pane.addBinding(
					quantizationEnabled,
					"value",
					{
						label: "quantize",
						index: 0,
					},
				);

				const ditherBinding = pane.addBinding(ditherEnabled, "value", {
					label: "dither",
					hidden: !quantizationEnabled.value,
				});

				quantizationBinding.on("change", (e) => {
					ditherBinding.hidden = !e.value;
				});
			},
		)}
	/>
	<canvas
		width={factor * w}
		height={factor * h}
		class="aspect-square md:aspect-video w-full"
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				canvas,
			});

			const renderPipeline = new t.RenderPipeline(renderer);

			const output = pass(scene, camera);
			const tex = output.getTextureNode();

			const up = 255;
			const bits = 5;
			const down = Math.ceil(up / 2 ** bits);
			renderPipeline.outputNode = Fn(() => {
				const color = texture(tex);
				return select(
					quantizationEnabled,
					color.setRGB(
						color.rgb
							.mul(up)
							.add(select(ditherEnabled, dither(), 0))
							.clamp(0, up)
							.div(down)
							.floor()
							.div(Math.floor(up / down)),
					),
					color,
				);
			})();

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
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
