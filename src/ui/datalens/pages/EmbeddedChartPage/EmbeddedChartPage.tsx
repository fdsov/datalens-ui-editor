import React from 'react';

import block from 'bem-cn-lite';
import {PreviewQa} from 'shared';
import {ChartWrapper} from 'ui/components/Widgets/Chart/ChartWidgetWithProvider';
import {DL} from 'ui/constants';
import {EMBEDDED_CHART_MESSAGE_NAME} from 'ui/constants/common';
import {PostMessage} from 'ui/units/dash/modules/postMessage';
import {sendEmbedHeight} from 'ui/units/preview/modules/helpers';
import {SNAPTER_DESIRED_CLASS} from 'ui/units/preview/modules/constants/constants';
import Utils from 'ui/utils';

import 'ui/styles/preview.scss';
import 'ui/units/preview/components/Preview/Preview.scss';

const b = block('preview');

/**
 * Standalone page for an embedded chart (`/embeds/chart`).
 *
 * The chart is not addressed by id: the BFF resolves it by the embedding token
 * that lives in the url hash fragment, so no entry identifiers are passed here.
 */
const EmbeddedChartPage = () => {
    const previewRef = React.useRef<HTMLDivElement>(null);

    const {noControls, actionParamsEnabled} = Utils.getOptionsFromSearch(window.location.search);
    const params = React.useMemo(() => Utils.getParamsFromSearch(window.location.search), []);

    React.useEffect(() => {
        if (!window.name) {
            return undefined;
        }

        const handleMessageSend = (event: MessageEvent<string>) => {
            if (event.data === EMBEDDED_CHART_MESSAGE_NAME) {
                sendEmbedHeight(previewRef.current);
            }
        };

        window.addEventListener('message', handleMessageSend);

        return () => {
            window.removeEventListener('message', handleMessageSend);
        };
    }, []);

    const onChartRender = React.useCallback(() => {
        if (previewRef.current && window.name) {
            sendEmbedHeight(previewRef.current);
            PostMessage.send({iFrameName: window.name, isRendered: true});
        }
    }, []);

    return (
        <div
            className={b({mobile: DL.IS_MOBILE}, SNAPTER_DESIRED_CLASS)}
            ref={previewRef}
            data-qa={PreviewQa.ChartWrapper}
        >
            <ChartWrapper
                usageType="chart"
                params={params}
                onChartRender={onChartRender}
                noControls={noControls}
                actionParamsEnabled={actionParamsEnabled}
                menuType="preview"
            />
        </div>
    );
};

export default EmbeddedChartPage;
