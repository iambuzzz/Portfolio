export interface HTMLAudioState {
  volume: number;
  playing: boolean;
}

export interface HTMLAudioProps {
  src: string;
  autoReplay?: boolean;
}

export function useAudio(props: HTMLAudioProps) {
  // Create the element once; don't fetch the file until it is first played.
  const [element] = useState(() => {
    const audio = new Audio(props.src);
    audio.preload = "none";
    return audio;
  });
  const ref = useRef<HTMLAudioElement>(element);

  const [state, setState] = useState<HTMLAudioState>({
    volume: 1,
    playing: false
  });

  const controls = {
    play: (): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        setState({ ...state, playing: true });
        return el.play();
      }
    },

    pause: (): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        setState({ ...state, playing: false });
        return el.pause();
      }
    },

    toggle: (play?: boolean): Promise<void> | void => {
      const el = ref.current;
      if (el) {
        const shouldPlay = play !== undefined ? play : !state.playing;
        const promise = shouldPlay ? el.play() : el.pause();
        setState({ ...state, playing: shouldPlay });
        return promise;
      }
    },

    volume: (value: number): void => {
      const el = ref.current;
      if (el) {
        value = Math.min(1, Math.max(0, value));
        el.volume = value;
        setState({ ...state, volume: value });
      }
    }
  };
  useEffect(() => {
    const handler = () => {
      if (props.autoReplay) controls.play();
    };

    element.addEventListener("ended", handler);
    return () => {
      element.removeEventListener("ended", handler);
    };
  }, [props.autoReplay]);

  useEffect(() => {
    const el = ref.current!;

    if (!el) return;
    if (el.getAttribute("src") !== props.src) el.src = props.src;

    setState({
      volume: el.volume,
      playing: !el.paused
    });
  }, [props.src]);

  return [element, state, controls, ref] as const;
}
