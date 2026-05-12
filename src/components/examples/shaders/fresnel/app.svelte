<script
	lang="ts"
	module
>
	const POWER_MIN = 0;
	const POWER_MAX = 3;
	const POWER_STEP = 0.5;

	const POWER_DIFF = POWER_MAX - POWER_MIN;
	const POWER_DEFAULT = 0.5 * POWER_DIFF;

	const f = normalWorld.dot(positionViewDirection).abs().setName("factor");
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { createDisposed } from "@functions/createDisposed.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { normalWorld, positionViewDirection, uniform } from "three/tsl";
	import {
		Color,
		Mesh,
		MeshBasicNodeMaterial,
		PerspectiveCamera,
		TorusKnotGeometry,
		WebGPURenderer,
	} from "three/webgpu";

	const baseColorUniform = uniform(new Color("#583583"));
	const fresnelColorUniform = uniform(new Color("#ccccaa"));
	const powerUniform = uniform(POWER_DEFAULT);

	const fresnel = f.pow(powerUniform).mul(baseColorUniform);
	const inverseFresnel = f
		.oneMinus()
		.pow(powerUniform)
		.mul(fresnelColorUniform);

	const material = createDisposed(MeshBasicNodeMaterial);
	material.colorNode = fresnel.add(inverseFresnel);

	const geometry = createDisposed(TorusKnotGeometry);

	const mesh = new Mesh(geometry, material);

	const camera = new PerspectiveCamera().translateZ(5);

	const colors = {
		base: `#${baseColorUniform.value.getHexString()}`,
		fresnel: `#${fresnelColorUniform.value.getHexString()}`,
	};

	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "controls",
			},
			(pane) => {
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
			},
		)}
	/>
	<canvas
		class="aspect-square md:md:aspect-video"
		{@attach controls(orbit)}
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

				orbit.update();
				renderer.render(mesh, camera);
			});

			return () => {
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
