import Image from 'next/image';

export default function Logo({ compact = false }) {
  return (
    <div className={compact ? 'logo compact' : 'logo'}>
      <Image
        src="/technology-changes-logo.png"
        alt="Технологія змін — 91 крок"
        width={compact ? 112 : 260}
        height={compact ? 112 : 260}
        priority
      />
    </div>
  );
}
