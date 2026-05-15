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
		Loop,
		bvec4,
		float,
		int,
		luminance,
		min,
		pass,
		screenCoordinate,
		screenSize,
		select,
		texture,
		uniform,
		uv,
		vec2,
		vec3,
		vec4,
	} from "three/tsl";
	import type { Node } from "three/webgpu";
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
	const output = scenePass.getTextureNode();

	const kernelSize = 3;
	const windowSize = int(kernelSize).mul(2).sub(1);
	const quadrantSize = windowSize.div(2);
	const sampleCount = quadrantSize.mul(quadrantSize);

	const stdAndAverageColor = Fn(
		({
			kernelSize,
			offset,
			center = screenCoordinate,
		}: {
			kernelSize: number;
			offset: Node<"vec2">;
			center?: Node<"vec2">;
		}): Node<"vec4"> => {
			const luminanceSum = float(0);
			const luminanceSum2 = float(0);
			const colorSum = vec3(0);
			Loop(kernelSize, ({ i: y }) => {
				Loop(kernelSize, ({ i: x }) => {
					const sample = texture(
						output,
						center.add(x, y).add(offset).div(screenSize),
					).rgb;
					const lum = luminance(sample);
					luminanceSum.addAssign(lum);
					luminanceSum2.addAssign(lum.mul(lum));
					colorSum.addAssign(sample);
				});
			});

			const mean = luminanceSum.div(sampleCount);
			const std = luminanceSum2.div(sampleCount.sub(mean.mul(mean)));

			return vec4(colorSum.div(sampleCount), std);
		},
	);

	const enabled = uniform(true);

	const main = Fn(() => {
		const q1 = stdAndAverageColor({
			offset: vec2(0, 0),
			kernelSize,
		});
		const q2 = stdAndAverageColor({
			offset: vec2(-1 * kernelSize, kernelSize),
			kernelSize,
		});
		const q3 = stdAndAverageColor({
			offset: vec2(-1 * kernelSize, -1 * kernelSize),
			kernelSize,
		});
		const q4 = stdAndAverageColor({
			offset: vec2(kernelSize, -1 * kernelSize),
			kernelSize,
		});

		const minStd = min(q1.w, q2.w, q3.w, q4.w);
		const q = bvec4(
			q1.w.equal(minStd),
			q2.w.equal(minStd),
			q3.w.equal(minStd),
			q4.w.equal(minStd),
		).toVec4();

		return select(
			enabled,
			vec4(
				q1.rgb
					.mul(q.x)
					.add(q2.rgb.mul(q.y))
					.add(q3.rgb.mul(q.z))
					.add(q4.rgb.mul(q.w)),
				1.0,
			),
			texture(output, uv()),
		);
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
			renderPipeline.outputNode = main();

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
