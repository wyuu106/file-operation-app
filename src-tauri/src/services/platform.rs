use std::io;
use std::path::Path;

#[cfg(target_os = "macos")]
pub fn rename_no_replace(
    from: &Path,
    to: &Path,
) -> io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let from =
        CString::new(from.as_os_str().as_bytes())
            .map_err(|_| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "invalid source path",
                )
            })?;
    let to =
        CString::new(to.as_os_str().as_bytes())
            .map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid destination path",
            )
        })?;
    const RENAME_EXCL: u32 = 0x0000_0004;
    let result = unsafe {
        libc::renamex_np(
            from.as_ptr(),
            to.as_ptr(),
            RENAME_EXCL,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(target_os = "windows")]
pub fn rename_no_replace(
    from: &Path,
    to: &Path,
) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::MoveFileW;

    let from: Vec<u16> = from
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let to: Vec<u16> = to
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        MoveFileW(from.as_ptr(), to.as_ptr())
    };
    if result != 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(any(
    target_os = "macos",
    target_os = "windows"
)))]
pub fn rename_no_replace(
    _from: &Path,
    _to: &Path,
) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "unsupported operating system",
    ))
}
