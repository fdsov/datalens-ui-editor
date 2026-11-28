import {parseMetaLinks, suggestAliasFromName, upsertMetaLink} from '../MetaLinksPicker';

describe('MetaLinksPicker helpers', () => {
    test('parseMetaLinks extracts valid string links and ignores invalid JSON', () => {
        expect(parseMetaLinks('{"links":{"PG":"9qpuryly00vit","DS":"abc"}}')).toEqual({
            PG: '9qpuryly00vit',
            DS: 'abc',
        });
        expect(parseMetaLinks('')).toEqual({});
        expect(parseMetaLinks('{broken')).toEqual({});
        expect(parseMetaLinks('{"links":{"ok":"id1","bad":123}}')).toEqual({ok: 'id1'});
    });

    test('upsertMetaLink creates links object when empty and preserves existing links', () => {
        const created = upsertMetaLink('', 'PG', '9qpuryly00vit');
        expect(JSON.parse(created)).toEqual({
            links: {
                PG: '9qpuryly00vit',
            },
        });

        const updated = upsertMetaLink(created, 'BONUS', 'nfwyzoeaybes6');
        expect(JSON.parse(updated)).toEqual({
            links: {
                PG: '9qpuryly00vit',
                BONUS: 'nfwyzoeaybes6',
            },
        });
    });

    test('suggestAliasFromName normalizes English and Russian entry names', () => {
        expect(suggestAliasFromName('yohoho database')).toBe('YOHOHO_DATABASE');
        expect(suggestAliasFromName('Бонус датасет 2026')).toBe('BONUS_DATASET_2026');
        expect(suggestAliasFromName('   ')).toBe('SOURCE');
    });
});
