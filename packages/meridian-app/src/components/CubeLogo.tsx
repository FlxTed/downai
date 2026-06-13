import styles from './CubeLogo.module.css';

export function CubeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      className={styles.cube}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M40 8 L68 24 L68 56 L40 72 L12 56 L12 24 Z" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M40 8 L40 40 M40 40 L68 24 M40 40 L12 24" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 40 L40 72" stroke="currentColor" strokeWidth="2" opacity="0.6"/>
      <path d="M12 24 L40 40 L68 24" stroke="currentColor" strokeWidth="2" opacity="0.8"/>
    </svg>
  );
}
