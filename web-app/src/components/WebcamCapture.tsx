import { useEffect, useRef, useState } from 'react';

interface WebcamCaptureProps {
  kind: 'image' | 'video';
  onCapture: (file: File) => void;
  onClose: () => void;
  onUnavailable: () => void;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export default function WebcamCapture({ kind, onCapture, onClose, onUnavailable }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: kind === 'video',
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) unavailableRef.current();
      }
    };
    void open();
    return () => {
      cancelled = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [kind]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const targetRatio = 9 / 16;
    const videoRatio = video.videoWidth / video.videoHeight;
    let sx = 0;
    let sy = 0;
    let sw = video.videoWidth;
    let sh = video.videoHeight;
    if (videoRatio > targetRatio) {
      sw = video.videoHeight * targetRatio;
      sx = (video.videoWidth - sw) / 2;
    } else {
      sh = video.videoWidth / targetRatio;
      sy = (video.videoHeight - sh) / 2;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `portfolio-photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      onCapture(new File([blob], `portfolio-video-${Date.now()}.webm`, { type: blob.type || 'video/webm' }));
      setRecording(false);
    };
    recorder.start();
    setSeconds(0);
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(23,23,23,0.45)] p-4" role="dialog" aria-modal="true" aria-label={kind === 'video' ? 'Record video' : 'Take photo'}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
        <video ref={videoRef} muted playsInline className="aspect-[9/16] w-full rounded-xl bg-black object-cover" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="h-11 px-4 text-sm font-semibold text-[#171717]">
            Cancel
          </button>
          {kind === 'image' ? (
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!ready}
              className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Capture
            </button>
          ) : recording ? (
            <button type="button" onClick={stopRecording} className="h-11 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white">
              Stop {clock}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={!ready}
              className="h-11 rounded-lg bg-[#5a7268] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
