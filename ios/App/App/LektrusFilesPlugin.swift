import Capacitor
import Foundation
import UIKit

/** Native export uses the system Files picker, not a WKWebView blob download. */
@objc(LektrusFilesPlugin)
class LektrusFilesPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "LektrusFilesPlugin"
    let jsName = "LektrusFiles"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "append", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let queue = DispatchQueue(label: "ru.lektrus.files")
    private let chunkBytes = 256 * 1024
    private let maxBytes = 512 * 1024 * 1024
    private var token: String?
    private var directory: URL?
    private var file: URL?
    private var handle: FileHandle?
    private var expected = 0
    private var written = 0
    private var pending: CAPPluginCall?

    private func owns(_ call: CAPPluginCall) -> Bool {
        guard let token = token else { return false }
        return call.getString("token") == token
    }

    private func clear() {
        try? handle?.close()
        if let directory = directory { try? FileManager.default.removeItem(at: directory) }
        token = nil; directory = nil; file = nil; handle = nil; pending = nil; written = 0
    }

    @objc func begin(_ call: CAPPluginCall) {
        queue.async {
            guard self.token == nil else { call.reject("Дождитесь завершения текущего сохранения"); return }
            let invalidCharacters = CharacterSet(charactersIn: "\\/:*?\"<>|").union(.controlCharacters)
            guard let name = call.getString("name"), !name.isEmpty, !name.hasPrefix("."),
                  name.utf16.count <= 180, name.utf8.count <= 240, name.rangeOfCharacter(from: invalidCharacters) == nil,
                  let size = call.getInt("size"), size >= 0, size <= self.maxBytes else {
                call.reject("Некорректные параметры файла"); return
            }
            do {
                let token = UUID().uuidString
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent("lektrus-export-" + token, isDirectory: true)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
                self.directory = directory
                let file = directory.appendingPathComponent(name, isDirectory: false)
                guard FileManager.default.createFile(atPath: file.path, contents: nil) else {
                    self.clear(); call.reject("Не удалось подготовить файл"); return
                }
                self.handle = try FileHandle(forWritingTo: file)
                self.file = file; self.token = token; self.expected = size; self.written = 0
                call.resolve(["token": token])
            } catch { self.clear(); call.reject("Не удалось подготовить файл") }
        }
    }

    @objc func append(_ call: CAPPluginCall) {
        queue.async {
            guard self.owns(call), self.pending == nil, let handle = self.handle,
                  call.getInt("offset") == self.written,
                  let encoded = call.getString("data"), encoded.utf8.count <= ((self.chunkBytes + 2) / 3) * 4,
                  let data = Data(base64Encoded: encoded), !data.isEmpty, data.count <= self.chunkBytes,
                  self.written + data.count <= self.expected else {
                call.reject("Некорректная часть файла"); return
            }
            do {
                try handle.write(contentsOf: data)
                self.written += data.count
                call.resolve()
            } catch { self.clear(); call.reject("Не удалось записать файл") }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        queue.async {
            guard self.owns(call), self.pending == nil, self.written == self.expected,
                  let file = self.file, let handle = self.handle else { call.reject("Файл ещё не готов"); return }
            do { try handle.close(); self.handle = nil }
            catch { self.clear(); call.reject("Не удалось записать файл"); return }
            self.pending = call
            DispatchQueue.main.async {
                guard let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                    self.queue.async { self.clear(); call.reject("Не удалось открыть сохранение файла") }
                    return
                }
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                picker.isModalInPresentation = true
                controller.present(picker, animated: true)
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        queue.async {
            if self.owns(call) && self.pending == nil { self.clear() }
            call.resolve()
        }
    }

    private func complete(saved: Bool) {
        queue.async {
            guard let pending = self.pending else { return }
            self.clear()
            pending.resolve(["saved": saved])
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        complete(saved: !urls.isEmpty)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        complete(saved: false)
    }
}

@objc(LektrusBridgeViewController)
class LektrusBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(LektrusFilesPlugin())
    }
}
