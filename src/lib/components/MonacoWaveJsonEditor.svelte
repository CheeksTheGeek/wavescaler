<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { themeStore } from '$lib/theme-store';
	import type { WaveJson } from '$lib/wavejson-types';
	import { generateWaveJsonString } from '$lib/wavejson-generator';
	import { parseWaveJson } from '$lib/wavejson-parser';

	export let waveJson: WaveJson;
	export let visible: boolean = false;

	const dispatch = createEventDispatcher<{
		change: { waveJson: WaveJson };
		error: { message: string };
	}>();

	let editorElement: HTMLDivElement;
	let editor: any;
	let model: any;
	let monaco: any;
	let isUpdatingFromProp = false;
	let isUpdatingFromEditor = false;

	// Monaco setup
	onMount(() => {
		if (!browser) return;

		let unsubscribeTheme: (() => void) | undefined;

		// Load Monaco asynchronously
		const loadMonaco = async () => {
			// Dynamic imports for client-side only
			const [
				monacoModule,
				editorWorkerModule,
				jsonWorkerModule
			] = await Promise.all([
				import('monaco-editor'),
				import('monaco-editor/esm/vs/editor/editor.worker?worker'),
				import('monaco-editor/esm/vs/language/json/json.worker?worker')
			]);

			monaco = monacoModule;
			const editorWorker = editorWorkerModule.default;
			const jsonWorker = jsonWorkerModule.default;

			// Setup Monaco environment
			(self as any).MonacoEnvironment = {
				getWorker: function (_: any, label: string) {
					if (label === 'json') {
						return new jsonWorker();
					}
					return new editorWorker();
				}
			};

			// Create editor with theme-aware configuration
			const effectiveTheme = $themeStore === 'auto' 
				? themeStore.getEffectiveTheme($themeStore)
				: $themeStore;

			editor = monaco.editor.create(editorElement, {
				language: 'json',
				theme: effectiveTheme === 'dark' ? 'vs-dark' : 'vs',
				automaticLayout: true,
				fontSize: 14,
				lineNumbers: 'on',
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				wordWrap: 'on',
				folding: true,
				tabSize: 2,
				insertSpaces: true,
				formatOnPaste: true,
				formatOnType: true,
				bracketPairColorization: { enabled: true },
				guides: {
					bracketPairs: true,
					indentation: true
				},
				suggest: {
					showKeywords: true,
					showSnippets: true
				}
			});

			// Set initial content
			updateEditorContent();

			// Listen for content changes
			model = editor.getModel()!;
			model.onDidChangeContent(() => {
				if (!isUpdatingFromProp) {
					handleEditorChange();
				}
			});

			// Listen for theme changes
			unsubscribeTheme = themeStore.subscribe((theme) => {
				if (editor && monaco) {
					const effectiveTheme = theme === 'auto' 
						? themeStore.getEffectiveTheme(theme)
						: theme;
					monaco.editor.setTheme(effectiveTheme === 'dark' ? 'vs-dark' : 'vs');
				}
			});
		};

		loadMonaco().catch(console.error);

		// Cleanup theme subscription on destroy
		return () => {
			if (unsubscribeTheme) {
				unsubscribeTheme();
			}
		};
	});

	// Update editor content when waveJson prop changes
	$: if (browser && editor && monaco && waveJson && !isUpdatingFromEditor) {
		updateEditorContent();
	}

	function updateEditorContent() {
		if (!browser || !editor || !monaco || isUpdatingFromEditor) return;
		
		isUpdatingFromProp = true;
		const result = generateWaveJsonString(waveJson, true);
		
		if (result.success && result.jsonString) {
			const currentValue = editor.getValue();
			if (currentValue !== result.jsonString) {
				editor.setValue(result.jsonString);
			}
		}
		
		// Reset flag after a short delay to allow for editor updates
		setTimeout(() => {
			isUpdatingFromProp = false;
		}, 10);
	}

	function handleEditorChange() {
		if (isUpdatingFromProp || !monaco || !editor) return;
		
		isUpdatingFromEditor = true;
		const content = editor.getValue();
		
		// Try to parse the content
		const parseResult = parseWaveJson(content);
		
		if (parseResult.success && parseResult.data) {
			// Clear any error markers
			monaco.editor.setModelMarkers(model, 'wavejson-parser', []);
			dispatch('change', { waveJson: parseResult.data });
		} else {
			// Show error in editor
			const lines = content.split('\n');
			monaco.editor.setModelMarkers(model, 'wavejson-parser', [{
				severity: monaco.MarkerSeverity.Error,
				message: parseResult.error || 'Invalid WaveJSON',
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: lines.length,
				endColumn: lines[lines.length - 1].length + 1
			}]);
			
			dispatch('error', { message: parseResult.error || 'Invalid WaveJSON' });
		}
		
		// Reset flag after a short delay
		setTimeout(() => {
			isUpdatingFromEditor = false;
		}, 10);
	}

	// Format the JSON content
	function formatJson() {
		if (browser && editor && monaco) {
			editor.getAction('editor.action.formatDocument')?.run();
		}
	}

	onDestroy(() => {
		if (browser) {
			if (model) {
				model.dispose();
			}
			if (editor) {
				editor.dispose();
			}
		}
	});
</script>

<div class="monaco-container" class:visible>
	<div class="monaco-header">
		<h3>WaveJSON Editor</h3>
		<button class="format-button" on:click={formatJson} title="Format JSON (Shift+Alt+F)">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
				<path d="M4 4h8v1H4zM4 6h6v1H4zM4 8h8v1H4zM4 10h5v1H4z"/>
			</svg>
			Format
		</button>
	</div>
	<div class="monaco-editor" bind:this={editorElement}></div>
</div>

<style>
	.monaco-container {
		display: none;
		flex-direction: column;
		height: 100%;
		background-color: var(--color-bg-elevated);
		border-left: 1px solid var(--color-border-primary);
		width: 400px;
		min-width: 300px;
		max-width: 600px;
		resize: horizontal;
		overflow: hidden;
	}

	.monaco-container.visible {
		display: flex;
	}

	.monaco-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background-color: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border-primary);
	}

	.monaco-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.format-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.format-button:hover {
		background-color: var(--color-bg-tertiary);
		border-color: var(--color-border-hover);
	}

	.format-button:active {
		transform: translateY(1px);
	}

	.monaco-editor {
		flex: 1;
		min-height: 0;
	}

	/* Resize handle styling */
	.monaco-container {
		position: relative;
	}

	.monaco-container::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		cursor: col-resize;
		background: transparent;
		z-index: 10;
	}

	.monaco-container::before:hover {
		background: var(--color-accent-primary);
		opacity: 0.5;
	}
</style> 
