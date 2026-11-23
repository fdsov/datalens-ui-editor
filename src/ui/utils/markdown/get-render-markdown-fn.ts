import {DL} from '../../constants';
import {registry} from '../../registry';

export async function getRenderMarkdownResultFn() {
    const {getAdditionalMarkdownPlugins} = registry.common.functions.getAll();
    const {renderHTML} = await import(
        /* webpackChunkName: "markdown" */ '../../../shared/modules/markdown/markdown'
    );
    const plugins = await getAdditionalMarkdownPlugins();
    return function (value: string) {
        return renderHTML({
            text: value,
            lang: DL.USER_LANG,
            plugins,
        });
    };
}

export async function getRenderMarkdownFn() {
    const renderMarkdown = await getRenderMarkdownResultFn();
    return (value: string) => renderMarkdown(value).result;
}
