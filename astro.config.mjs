// @ts-check
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = "https://let-josh.github.io";

const base = "/graphics-glossary";

const repoURL = "https://github.com/let-josh" + base;

// https://astro.build/config
export default defineConfig({
	base,
	integrations: [
		starlight({
			customCss: ["./src/styles/global.css"],
			editLink: {
				baseUrl: `${repoURL}/edit/main`,
			},
			expressiveCode: {
				themes: ["rose-pine", "rose-pine-dawn"],
			},
			sidebar: [
				{
					label: "Data Buffers",
					items: [
						{
							autogenerate: { directory: "data-buffers" },
						},
					],
				},
				{
					label: "Shaders",
					items: [
						{
							autogenerate: { directory: "shaders" },
						},
					],
				},
				{
					label: "Postprocessing",
					items: [
						{
							autogenerate: {
								directory: "postprocessing",
							},
						},
					],
				},
				{
					label: "Shadows",
					items: [
						{
							autogenerate: {
								directory: "shadows",
							},
						},
					],
				},
				{
					label: "Techniques",
					items: [
						{
							autogenerate: {
								directory: "techniques",
							},
						},
					],
				},
				{
					label: "Environment Mapping",
					items: [
						{
							autogenerate: {
								directory: "environment-mapping",
							},
						},
					],
				},
				{
					label: "Miscellaneous",
					items: [
						{
							autogenerate: {
								directory: "miscellaneous",
							},
						},
					],
				},
			],
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: repoURL,
				},
			],
			title: "3d graphics glossary",
		}),
		svelte(),
		sitemap(),
	],
	site,
	vite: {
		assetsInclude: ["**/*.hdr", "**/*.glb"],
		plugins: [tailwindcss()],
	},
});
