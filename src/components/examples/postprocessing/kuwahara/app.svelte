<script
	lang="ts"
	module
>
	import gltfUrl from "@assets/gltfs/IridescenceAbalone.glb";
	import hdrUrl from "@assets/hdrs/suburban_garden_1k.hdr";

	const hdrLoader = new HDRLoader();
	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { sample } from "./kuwahara";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		GLTFLoader,
		HDRLoader,
		OrbitControls,
	} from "three/examples/jsm/Addons.js";
	import {
		Fn,
		If,
		pass,
		select,
		texture,
		uniform,
		vec2,
		vec4,
	} from "three/tsl";
	import {
		EquirectangularReflectionMapping,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();
	const axis = new Vector3(0.5, 0.5, 1).normalize();
	const camera = new PerspectiveCamera().translateOnAxis(axis, 0.25);

	const orbit = new OrbitControls(camera);

	const hdr = hdrLoader.loadAsync(hdrUrl).then((hdr) => {
		hdr.mapping = EquirectangularReflectionMapping;
		scene.background = scene.environment = hdr;
		return hdr;
	});

	onCleanup(() => {
		hdr.then((hdr) => {
			hdr.dispose();
		});
	});

	gltfLoader.loadAsync(gltfUrl).then((gltf) => {
		scene.add(gltf.scene);
		return gltf;
	});

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	const size = 3;

	const enabled = uniform(true);

	const main = Fn(() => {
		const q1 = sample(tex, {
			size,
			offset: vec2(0, 0),
		});

		const color = q1.rgb;
		const minStd = q1.w;

		const q2 = sample(tex, {
			size,
			offset: vec2(-1 * size, size),
		});

		If(q2.w.lessThan(minStd), () => {
			minStd.assign(q2.w);
			color.assign(q2.rgb);
		});

		const q3 = sample(tex, {
			size,
			offset: vec2(-1 * size, -1 * size),
		});

		If(q3.w.lessThan(minStd), () => {
			minStd.assign(q3.w);
			color.assign(q3.rgb);
		});

		const q4 = sample(tex, {
			size,
			offset: vec2(size, -1 * size),
		});

		If(q4.w.lessThan(minStd), () => {
			minStd.assign(q4.w);
			color.assign(q4.rgb);
		});

		return vec4(color, 1.0);
	});

	let rotationEnabled = {
		value: false,
	};
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "controls",
			},

			(pane) => {
				pane.addBinding(rotationEnabled, "value", {
					label: "rotate",
				});
				const uniformsFolder = pane.addFolder({
					title: "uniforms",
				});

				uniformsFolder.addBinding(enabled, "value", {
					label: "enabled",
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

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = select(enabled, main(), tex);

			const rotationSpeed = Math.PI / 300;

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}
				scene.rotateX(rotationSpeed * +rotationEnabled.value);

				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
