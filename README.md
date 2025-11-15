# Gr.4-RrejtatKompjuterike

Our Group Members: 
  Anis Millaku 
  Amat Raqi
  Diellart Mulolli
  Shpetim Panduri

Simple UDP-based file server and client in Javascript.
Server runs on port 5000. Max 4 clients. First client is admin.
Admin can list, read, upload, download, delete, search, get info and stats.
Regular clients can only send messages.


SERVER COMMANDS (admin only)
 /list               list files in ./files
 /read <file>        read file content
 /upload <file>      send local file to server
 /download <file>    download file from server to local
 /delete <file>      delete file on server
 /search <keyword>   search files by name
 /info <file>        file metadata
 /STATS              server traffic stats

REGULAR CLIENT
Any other text is echoed back by server.

HOW TO RUN
1. Open terminal in UDPcommunication folder
2. Start server: node server.js
3. In another terminal (same folder): node client.js
4. Type commands after > prompt

UPLOAD
> /upload file1
Sends local file1 to server if it exists in current folder.

DOWNLOAD
> /download file1
Server sends file content. Client saves it locally as file1.

NOTES
- Run client from UDPcommunication folder (file1 must be there).
- Server stores files in ./files folder.
- Admin is first connected client.
- Clients timeout after 120 seconds of inactivity.
- Stats saved to server_stats.txt