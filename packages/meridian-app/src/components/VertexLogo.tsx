import styles from './VertexLogo.module.css';

interface Props {
  size?: number;
}

export function VertexLogo({ size = 32 }: Props) {
  return (
    <svg
      className={styles.logo}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path className={styles.right} d="M 256 120 L 392 188 L 392 324 L 256 392 Z" />
      <path className={styles.left} d="M 256 120 L 120 188 L 120 324 L 256 392 Z" />
      <path className={styles.top} d="M 256 120 L 120 188 L 256 256 L 392 188 Z" />
    </svg>
  );
}
