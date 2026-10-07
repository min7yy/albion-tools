/** Item icon from the official render service; hidden if it fails to load. */
export function ItemIcon({ id, size = 32 }: { id: string; size?: number }) {
  return (
    <img
      className="item-icon"
      src={`https://render.albiononline.com/v1/item/${encodeURIComponent(id)}.png?size=${size * 2}`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
    />
  )
}
