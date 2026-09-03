import type {DashEntry} from 'shared';
import {DL_EMBED_TOKEN_HEADER, EMBEDDED_ENTRY_API_PATH, EntryScope} from 'shared';
import {axiosInstance} from 'ui/libs';
import {getSecureEmbeddingToken} from 'ui/utils/embedded';

type EmbeddedEntryResponse = Pick<DashEntry, 'entryId' | 'scope' | 'data'>;

/**
 * Embedded dashboards are not addressed by entryId: the BFF resolves the entry
 * by the embedding token and returns only the safe subset of its fields.
 */
export async function fetchEmbeddedDashEntry(): Promise<DashEntry> {
    const embedToken = getSecureEmbeddingToken();

    if (!embedToken) {
        throw new Error('EMBEDDING_TOKEN_NOT_FOUND');
    }

    const {data} = await axiosInstance.get<EmbeddedEntryResponse>(EMBEDDED_ENTRY_API_PATH, {
        headers: {[DL_EMBED_TOKEN_HEADER]: embedToken},
    });

    if (!data?.entryId || data.scope !== EntryScope.Dash) {
        throw new Error('EMBEDDED_ENTRY_NOT_FOUND');
    }

    // Fields that are intentionally not exposed by the embedded-entry endpoint
    // (author, permissions, revisions) are filled with safe read-only defaults.
    return {
        entryId: data.entryId,
        scope: EntryScope.Dash,
        type: '',
        key: '',
        data: data.data,
        links: {},
        meta: {},
        savedId: '',
        revId: '',
        publishedId: '',
        updatedAt: '',
        annotation: null,
    };
}
