# Large Lecture Upload Fix (200 MB+)

## Issues Fixed

### 1. **Frontend Duration Limit (CRITICAL)**
- **Problem**: 30-minute duration limit was blocking longer lectures
- **Solution**: Increased limit to 2 hours (120 minutes)
- **File**: `frontend/src/views/TeacherLecturesPage.jsx`
- **Impact**: Now supports lectures up to 2 hours in duration

### 2. **File Size Validation**
- **Added**: Explicit 1GB file size check with clear error message
- **File**: `frontend/src/views/TeacherLecturesPage.jsx`
- **Impact**: Better user feedback for oversized files

### 3. **Server Body Size Limit**
- **Problem**: 1MB JSON body limit could cause metadata submission failures
- **Solution**: Increased to 10MB for both JSON and URL-encoded data
- **File**: `backend/src/server.js`
- **Impact**: Handles larger metadata payloads reliably

### 4. **Cloudinary Upload Optimization**
- **Backend**: Increased chunk size from 6MB to 20MB with 10-minute timeout per chunk
- **Frontend**: Added `maxContentLength: Infinity` and `maxBodyLength: Infinity` to axios config
- **Impact**: More reliable uploads for large files

### 5. **Error Handling**
- **Added**: Fallback for media metadata loading failures
- **Impact**: Files with codec issues can still be uploaded

## Current Upload Limits

| Limit Type | Value |
|------------|-------|
| Maximum File Size | 1 GB |
| Maximum Duration | 2 hours (120 minutes) |
| Cloudinary Chunk Size | 20 MB |
| Server JSON Body Limit | 10 MB |
| Multer File Size Limit | 1 GB |

## How It Works

1. **Direct Cloudinary Upload**: Large files bypass the server and upload directly to Cloudinary
2. **Progress Tracking**: Real-time upload progress shown to users
3. **Metadata Only**: Server only receives file metadata (URL, size, name) after Cloudinary upload completes
4. **No Server Timeout**: Files don't hit Render's 30-second timeout because they never go through the server

## Testing Your 200 MB Lecture

1. Make sure your backend server is running: `cd backend && npm start`
2. Make sure your frontend is running: `cd frontend && npm run dev`
3. Navigate to the Teacher Lectures page
4. Upload your 200 MB lecture file
5. Watch the progress bar - it should upload successfully to Cloudinary
6. Once complete, the lecture will be saved to your database

## Troubleshooting

### If upload still fails:

1. **Check Cloudinary limits**: Free tier has upload limits
2. **Check browser console**: Look for specific error messages
3. **Check network**: Large uploads need stable internet
4. **Try smaller chunks**: Edit `chunk_size` in `backend/src/routes/lectures.js` if needed

### Cloudinary Free Tier Limits:
- 25 GB storage
- 25 GB bandwidth/month
- 10 GB video storage
- Max video file: 100 MB (can be increased with chunked upload)

If you're hitting Cloudinary limits, consider upgrading your plan or using a different storage solution.

## Files Modified

1. `frontend/src/views/TeacherLecturesPage.jsx` - Duration limit, file size check, axios config
2. `backend/src/server.js` - Body size limits
3. `backend/src/routes/lectures.js` - Cloudinary chunk size and timeout

## Next Steps

- Test with your 200 MB file
- Monitor Cloudinary dashboard for upload status
- Consider adding file compression for even larger files
- Add retry logic for failed uploads
