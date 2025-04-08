import { useRef, useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocossd from "@tensorflow-models/coco-ssd";
import "./styles.css";

// Helper function to extract YouTube thumbnails
const getYouTubeThumbnail = (url) => {
  const videoId = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
  )?.[1];
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
};

// DIY Projects Database with Links
const PROJECTS = {
  bottle: [
    {
      title: "♻️ Plastic Bottle Projects",
      links: [
        {
          type: "video",
          title: "Self-Watering Plant System",
          url: "https://youtu.be/9HIC__5x404",
          thumbnail: getYouTubeThumbnail("https://youtu.be/9HIC__5x404"),
        },
        {
          type: "article",
          title: "25 Brilliant Bottle Recycling Ideas",
          url: "https://www.boredpanda.com/plastic-bottle-recycling-ideas/",
          source: "Bored Panda",
        },
      ],
    },
  ],
  cup: [
    {
      title: "🖊️ Cup Upcycling Ideas",
      links: [
        {
          type: "video",
          title: "DIY Pen Holder from Plastic Cups",
          url: "https://www.youtube.com/watch?v=5keP9lY5VII",
          thumbnail: getYouTubeThumbnail(
            "https://www.youtube.com/watch?v=5keP9lY5VII"
          ),
        },
        {
          type: "article",
          title: "10 Creative Uses for Old Cups",
          url: "https://www.upcyclethat.com/plastic-cup-projects/",
          source: "Upcycle That",
        },
      ],
    },
  ],
};

export default function App() {
  const [scannedItem, setScannedItem] = useState(null);
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detectionInterval, setDetectionInterval] = useState(null);

  const videoRef = useRef();
  const canvasRef = useRef();

  // Load TensorFlow model on startup
  useEffect(() => {
    async function loadModel() {
      try {
        setLoading(true);
        await tf.ready();
        const loadedModel = await cocossd.load();
        setModel(loadedModel);
        setLoading(false);
      } catch (err) {
        setError("Failed to load model: " + err.message);
        setLoading(false);
      }
    }
    loadModel();

    // Cleanup function
    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
      stopCamera();
    };
  }, []);

  // Resize canvas to match video dimensions
  useEffect(() => {
    const resizeCanvas = () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
      }
    };

    window.addEventListener("resize", resizeCanvas);

    // Initial resize
    if (videoRef.current) {
      videoRef.current.addEventListener("loadedmetadata", resizeCanvas);
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (videoRef.current) {
        videoRef.current.removeEventListener("loadedmetadata", resizeCanvas);
      }
    };
  }, [videoRef.current, canvasRef.current]);

  // Start camera and detection
  const startDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Clear any existing interval
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }

      // Detect objects every 500ms
      const interval = setInterval(() => detectObjects(), 500);
      setDetectionInterval(interval);
    } catch (err) {
      setError("Camera error: " + err.message);
    }
  };

  // Detect objects using TensorFlow
  const detectObjects = async () => {
    if (!model || !videoRef.current || !canvasRef.current) return;

    try {
      const predictions = await model.detect(videoRef.current);
      drawPredictions(predictions);

      // Check for plastic items
      const plasticItems = ["bottle", "cup"];
      const detectedItem = predictions.find(
        (pred) => plasticItems.includes(pred.class) && pred.score > 0.7
      );

      if (detectedItem) {
        setScannedItem(detectedItem.class);
        stopCamera();

        // Clear detection interval
        if (detectionInterval) {
          clearInterval(detectionInterval);
          setDetectionInterval(null);
        }
      }
    } catch (err) {
      console.error("Detection error:", err);
    }
  };

  // Draw bounding boxes
  const drawPredictions = (predictions) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    predictions.forEach((pred) => {
      // Get prediction box coordinates and dimensions
      const [x, y, width, height] = pred.bbox;

      // Draw bounding box
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      // Draw label
      ctx.fillStyle = "#00FF00";
      ctx.font = "18px Arial";
      ctx.fillText(
        `${pred.class} (${Math.round(pred.score * 100)}%)`,
        x,
        y > 20 ? y - 5 : y + 25
      );
    });
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  const resetScanner = () => {
    setScannedItem(null);
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="app">
      <h1>♻️ Smart Plastic Scanner</h1>

      {loading && <p>Loading model, please wait...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !scannedItem ? (
        <div>
          <div className="scanner-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="video-feed"
            />
            <canvas ref={canvasRef} className="canvas-overlay" />
          </div>
          <button
            onClick={startDetection}
            className="action-button start-button"
          >
            Start Detection
          </button>
        </div>
      ) : (
        !loading && (
          <div>
            <h2>DIY Projects for {scannedItem}:</h2>
            {PROJECTS[scannedItem]?.map((project, index) => (
              <div key={index} className="project-card">
                <h3>{project.title}</h3>
                <div className="links-container">
                  {project.links.map((link, i) => (
                    <div key={i} className="link-item">
                      {link.type === "video" && (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-link"
                        >
                          <img
                            src={link.thumbnail}
                            alt=""
                            className="video-thumbnail"
                          />
                          <div className="video-info">
                            <div className="video-title">{link.title}</div>
                            <div className="video-source">YouTube Tutorial</div>
                          </div>
                        </a>
                      )}

                      {link.type === "article" && (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="article-link"
                        >
                          <div className="video-title">{link.title}</div>
                          <div className="video-source">{link.source}</div>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={resetScanner}
              className="action-button reset-button"
            >
              Scan Another Item
            </button>
          </div>
        )
      )}
    </div>
  );
}
