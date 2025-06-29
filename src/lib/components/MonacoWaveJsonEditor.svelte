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

	// Define custom Monaco themes that match Wavescaler's theme
	const wavescalerLightTheme = {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'string.key.json', foreground: '3b82f6', fontStyle: 'bold' },  // accent-primary for keys
			{ token: 'string.value.json', foreground: 'ff17e8' },  // success color for string values
			{ token: 'number.json', foreground: 'f59e0b' },  // warning color for numbers
			{ token: 'keyword.json', foreground: 'ef4444' },  // error color for keywords (null, true, false)
			{ token: 'delimiter.bracket.json', foreground: '475569' },  // text-secondary for brackets
			{ token: 'delimiter.array.json', foreground: '475569' },  // text-secondary for array delimiters
			{ token: 'delimiter.comma.json', foreground: '475569' }  // text-secondary for commas
		],
		colors: {
			'editor.background': '#ffffff',  // bg-primary
			'editor.foreground': '#0f172a',  // text-primary
			'editorLineNumber.foreground': '#64748b',  // text-tertiary
			'editorLineNumber.activeForeground': '#475569',  // text-secondary
			'editor.lineHighlightBackground': '#f1f5f9',  // bg-tertiary with transparency
			'editor.selectionBackground': '#ff9717',  // accent-primary with transparency
			'editorCursor.foreground': '#3b82f6',  // accent-primary
			'editorWhitespace.foreground': '#94a3b833',  // text-placeholder with transparency
			'editorIndentGuide.background': '#e2e8f0',  // border-primary
			'editorIndentGuide.activeBackground': '#cbd5e1',  // border-secondary
			'editorBracketMatch.background': '#3b82f61a',  // accent-light
			'editorBracketMatch.border': '#3b82f6'  // accent-primary
		}
	};

	const wavescalerDarkTheme = {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'string.key.json', foreground: '6366f1', fontStyle: 'bold' },  // accent-primary for keys
			{ token: 'string.value.json', foreground: '22c0c5' },  // success color for string values
			{ token: 'number.json', foreground: 'eab308' },  // warning color for numbers
			{ token: 'keyword.json', foreground: 'f87171' },  // error color for keywords
			{ token: 'delimiter.bracket.json', foreground: 'cbd5e1' },  // text-secondary for brackets
			{ token: 'delimiter.array.json', foreground: 'cbd5e1' },  // text-secondary for array delimiters
			{ token: 'delimiter.comma.json', foreground: 'cbd5e1' }  // text-secondary for commas
		],
		colors: {
			'editor.background': '#16161d',  // bg-primary
			'editor.foreground': '#f1f5f9',  // text-primary
			'editorLineNumber.foreground': '#94a3b8',  // text-tertiary
			'editorLineNumber.activeForeground': '#cbd5e1',  // text-secondary
			'editor.lineHighlightBackground': '#ff9717',  // bg-tertiary with transparency
			'editor.selectionBackground': '#ff9717',  // accent-primary with transparency
			'editorCursor.foreground': '#6366f1',  // accent-primary
			'editorWhitespace.foreground': '#64748b33',  // text-placeholder with transparency
			'editorIndentGuide.background': '#2d2d3a',  // border-primary
			'editorIndentGuide.activeBackground': '#3d3d4a',  // border-secondary
			'editorBracketMatch.background': '#6366f11a',  // accent-light
			'editorBracketMatch.border': '#6366f1'  // accent-primary
		}
	};

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

			// Define custom themes
			monaco.editor.defineTheme('wavescaler-light', wavescalerLightTheme);
			monaco.editor.defineTheme('wavescaler-dark', wavescalerDarkTheme);

			// Create editor with theme-aware configuration
			const effectiveTheme = $themeStore === 'auto' 
				? themeStore.getEffectiveTheme($themeStore)
				: $themeStore;

			editor = monaco.editor.create(editorElement, {
				language: 'json',
				theme: effectiveTheme === 'dark' ? 'wavescaler-dark' : 'wavescaler-light',
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
				fixedOverflowWidgets: true,
				overflowWidgetsDomNode: editorElement,
				roundedSelection: true,
				smoothScrolling: true,
				contextmenu: false,
				scrollbar: {
					useShadows: false,
					verticalHasArrows: false,
					horizontalHasArrows: false,
					vertical: 'visible',
					horizontal: 'visible',
					verticalScrollbarSize: 10,
					horizontalScrollbarSize: 10,
					arrowSize: 0
				},
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

			// Additional editor styling after creation
			const editorDomNode = editor.getDomNode();
			if (editorDomNode) {
				editorDomNode.style.borderRadius = '0 0 var(--radius-lg) 0';
			}

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
					monaco.editor.setTheme(effectiveTheme === 'dark' ? 'wavescaler-dark' : 'wavescaler-light');
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
	<div class="monaco-editor-wrapper">
		<div class="monaco-editor-inner" bind:this={editorElement}></div>
	</div>
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
		border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
		isolation: isolate;
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
		border-radius: 0 var(--radius-lg) 0 0;
		z-index: 1;
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
		font-weight: 500;
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

	.monaco-editor-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
		border-radius: 0 0 var(--radius-lg) 0;
		mask-image: radial-gradient(white, black);
		-webkit-mask-image: -webkit-radial-gradient(white, black);
		z-index: 0;
	}

	.monaco-editor-inner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 0 0 var(--radius-lg) 0;
	}

	/* Ensure Monaco editor respects container's border radius */
	:global(.monaco-editor) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	:global(.monaco-editor .overflow-guard) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		mask-image: radial-gradient(white, black);
		-webkit-mask-image: -webkit-radial-gradient(white, black);
		overflow: hidden !important;
	}

	:global(.monaco-editor .monaco-scrollable-element) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	:global(.monaco-editor .monaco-scrollable-element > .scrollbar) {
		border-radius: var(--radius-lg) !important;
	}

	:global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider) {
		border-radius: var(--radius-sm) !important;
		margin: 2px !important;
	}

	/* Ensure content doesn't overflow the rounded corners */
	:global(.monaco-editor .view-overlays),
	:global(.monaco-editor .view-lines),
	:global(.monaco-editor .decorationsOverviewRuler),
	:global(.monaco-editor .scrollbar.vertical),
	:global(.monaco-editor .scrollbar.horizontal) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
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
		background: var(--color-accent-light);
	}
</style> 
