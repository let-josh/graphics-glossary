<script
	lang="ts"
	module
>
	const POWER_MIN = 0;
	const POWER_MAX = 3;
	const POWER_STEP = 0.5;

	const POWER_DIFF = POWER_MAX - POWER_MIN;
	const POWER_DEFAULT = 0.5 * POWER_DIFF;

	const f = normalWorld.dot(positionWorldDirection).abs().setName("factor");
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { normalWorld, positionWorldDirection, uniform } from "three/tsl";
	import { Pane } from "tweakpane";

	const baseColorUniform = uniform(new t.Color("#583583"));
	const fresnelColorUniform = uniform(new t.Color("#ccccaa"));
	const powerUniform = uniform(POWER_DEFAULT);

	const fresnel = f.pow(powerUniform).mul(baseColorUniform);
	const inverseFresnel = f
		.oneMinus()
		.pow(powerUniform)
		.mul(fresnelColorUniform);

	const material = new t.MeshBasicNodeMaterial({
		colorNode: fresnel.add(inverseFresnel),
	});

	const geometry = new t.TorusKnotGeometry();

	const mesh = new t.Mesh(geometry, material);

	const camera = new t.PerspectiveCamera();
	fitCameraToObject(camera, mesh, {
		fudge: 1.1,
	});

	const colors = {
		base: `#${baseColorUniform.value.getHexString()}`,
		fresnel: `#${fresnelColorUniform.value.getHexString()}`,
	};

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	onCleanup(() => {
		material.dispose();
		geometry.dispose();
	});
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});

			pane
				.addBinding(colors, "base", {
					label: "base color",
				})
				.on("change", (e) => {
					baseColorUniform.value.set(e.value);
				});

			pane
				.addBinding(colors, "fresnel", {
					label: "fresnel color",
				})
				.on("change", (e) => {
					fresnelColorUniform.value.set(e.value);
				});

			pane.addBinding(powerUniform, "value", {
				label: "power",
				min: POWER_MIN,
				max: POWER_MAX,
				step: POWER_STEP,
			});
		}}
	/>
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

			const setAnimationLoop = renderer.setAnimationLoop(() => {
				orbit.update();
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
