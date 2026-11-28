import React, {useEffect, useRef} from 'react';

import PropTypes from 'prop-types';
import {useSelector} from 'react-redux';
import {useSetState} from 'ui';

import {EVENT_FORMAT_EDITOR} from '../../constants/common';
import {getEditorDefaultOptions} from '../../libs/monaco/options';
import {MonacoUtils} from '../../libs/monaco/utils';
import {parseMetaLinks} from '../MetaLinksPicker/MetaLinksPicker';
import MonacoEditor from '../MonacoEditor/MonacoEditor';

const options = getEditorDefaultOptions();

const Editor = ({id, language, value, onChangeEditor, onModuleClick, highlightRange, size}) => {
    const disposeTypesRef = useRef(null);
    const disposeMetaCompletionRef = useRef(null);
    const [state, setState] = useSetState({
        editor: null,
        monaco: null,
        decorations: [],
    });
    const revId = useSelector((state) => state.editor?.entry?.revId);
    const metaScript = useSelector((state) => state.editor?.scriptsValues?.meta);
    const metaScriptRef = useRef(metaScript);
    metaScriptRef.current = metaScript;

    useEffect(() => {
        if (!state.editor) {
            return undefined;
        }
        const onFormatEvent = (event) => {
            if (event.detail?.scriptId && event.detail.scriptId !== id) {
                return;
            }
            const action = state.editor.getAction('editor.action.formatDocument');
            if (action) {
                action.run();
            }
        };
        window.addEventListener(EVENT_FORMAT_EDITOR, onFormatEvent);
        return () => {
            window.removeEventListener(EVENT_FORMAT_EDITOR, onFormatEvent);
        };
    }, [id, state.editor]);

    useEffect(() => {
        return () => {
            if (disposeMetaCompletionRef.current) {
                disposeMetaCompletionRef.current.dispose();
                disposeMetaCompletionRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let decorations = state.decorations;
        if (state.editor) {
            const range = highlightRange && id === highlightRange.id ? highlightRange.range : null;
            decorations = MonacoUtils.highlighRange(
                state.editor,
                state.monaco,
                range,
                state.decorations,
            );
        }
        setState({decorations});
    }, [highlightRange, id, state.editor]);

    const onChange = (newValue) => {
        onChangeEditor({value: newValue, scriptId: id});
    };

    const getRevId = React.useCallback(() => revId, [revId]);

    function editorDidMount(editor, monaco) {
        MonacoUtils.setDefaults(monaco);
        MonacoUtils.addModuleClickAction(editor, onModuleClick);
        MonacoUtils.addKeybinds(editor, monaco);
        MonacoUtils.highlightLines(editor, monaco, id);
        MonacoUtils.addActionMakeTabUrl(editor, monaco, id, getRevId);
        if (disposeMetaCompletionRef.current) {
            disposeMetaCompletionRef.current.dispose();
        }
        disposeMetaCompletionRef.current = MonacoUtils.addMetaLinksCompletion(monaco, () =>
            parseMetaLinks(metaScriptRef.current),
        );
        setState({editor, monaco});
    }

    function onFocus(editor, monaco) {
        if (disposeTypesRef.current) {
            disposeTypesRef.current.dispose();
        }
        disposeTypesRef.current = MonacoUtils.addTypes(editor, monaco, id, language);
    }

    function onBlur() {
        if (disposeTypesRef.current) {
            disposeTypesRef.current.dispose();
        }
        disposeTypesRef.current = null;
    }

    return (
        <MonacoEditor
            id={id}
            language={language}
            value={value}
            options={options}
            onChange={onChange}
            editorDidMount={editorDidMount}
            onFocus={onFocus}
            onBlur={onBlur}
            size={size}
        />
    );
};

Editor.propTypes = {
    id: PropTypes.string.isRequired,
    language: PropTypes.string.isRequired,
    value: PropTypes.string,
    onChangeEditor: PropTypes.func.isRequired,
    onModuleClick: PropTypes.func.isRequired,
    highlightRange: PropTypes.shape({
        range: PropTypes.array,
        id: PropTypes.string,
    }),
    size: PropTypes.number,
};

export default React.memo(Editor);
