'use client';

import ProtectedMedia from './ProtectedMedia';

export default function StepBlocks({ blocks = [], spaceSlug, watermark }) {
  if (!blocks.length) return null;
  return (
    <div className="stepBlocks">
      {blocks.map(block => {
        if (['video','audio','pdf','image','file'].includes(block.block_type) && block.media_asset_id) {
          return <section key={block.id} className="stepBlock mediaBlock">{block.title && <h3>{block.title}</h3>}<ProtectedMedia mediaId={block.media_asset_id} spaceSlug={spaceSlug} watermark={watermark} /></section>;
        }
        if (block.block_type === 'divider') return <hr key={block.id} className="goldDivider" />;
        if (block.block_type === 'link') return <p key={block.id} className="stepBlock"><a href={block.config?.url || '#'} target="_blank" rel="noreferrer">{block.title || block.body || 'Відкрити посилання'}</a></p>;
        if (block.block_type === 'quote') return <blockquote key={block.id} className="stepQuote">{block.body}</blockquote>;
        if (block.block_type === 'checklist') {
          const items = Array.isArray(block.config?.items) ? block.config.items : String(block.body || '').split('\n').filter(Boolean);
          return <div key={block.id} className="stepChecklist">{block.title && <h3>{block.title}</h3>}{items.map((item,i) => <label key={i}><input type="checkbox" /> <span>{item}</span></label>)}</div>;
        }
        return <div key={block.id} className="courseText stepText stepBlock">{block.title && <h3>{block.title}</h3>}{block.body}</div>;
      })}
    </div>
  );
}
