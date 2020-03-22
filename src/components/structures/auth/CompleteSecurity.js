/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { accessSecretStorage, AccessCancelledError } from '../../../CrossSigningManager';

const PHASE_INTRO = 0;
const PHASE_BUSY = 1;
const PHASE_DONE = 2;
const PHASE_CONFIRM_SKIP = 3;

export default class CompleteSecurity extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
    };

    constructor() {
        super();

        this.state = {
            phase: PHASE_INTRO,
            // this serves dual purpose as the object for the request logic and
            // the presence of it insidicating that we're in 'verify mode'.
            // Because of the latter, it lives in the state.
            verificationRequest: null,
            backupInfo: null,
        };
        MatrixClientPeg.get().on("crypto.verification.request", this.onVerificationRequest);
    }

    componentWillUnmount() {
        if (this.state.verificationRequest) {
            this.state.verificationRequest.off("change", this.onVerificationRequestChange);
        }
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("crypto.verification.request", this.onVerificationRequest);
        }
    }

    _onUsePassphraseClick = async () => {
        this.setState({
            phase: PHASE_BUSY,
        });
        const cli = MatrixClientPeg.get();
        try {
            const backupInfo = await cli.getKeyBackupVersion();
            this.setState({backupInfo});

            // The control flow is fairly twisted here...
            // For the purposes of completing security, we only wait on getting
            // as far as the trust check and then show a green shield.
            // We also begin the key backup restore as well, which we're
            // awaiting inside `accessSecretStorage` only so that it keeps your
            // passphase cached for that work. This dialog itself will only wait
            // on the first trust check, and the key backup restore will happen
            // in the background.
            await new Promise((resolve, reject) => {
                try {
                    accessSecretStorage(async () => {
                        await cli.checkOwnCrossSigningTrust();
                        resolve();
                        if (backupInfo) {
                            // A complete restore can take many minutes for large
                            // accounts / slow servers, so we allow the dialog
                            // to advance before this.
                            await cli.restoreKeyBackupWithSecretStorage(backupInfo);
                        }
                    });
                } catch (e) {
                    console.error(e);
                    reject(e);
                }
            });

            if (cli.getCrossSigningId()) {
                this.setState({
                    phase: PHASE_DONE,
                });
            }
        } catch (e) {
            if (!(e instanceof AccessCancelledError)) {
                console.log(e);
            }
            // this will throw if the user hits cancel, so ignore
            this.setState({
                phase: PHASE_INTRO,
            });
        }
    }

    onVerificationRequest = async (request) => {
        if (request.otherUserId !== MatrixClientPeg.get().getUserId()) return;

        if (this.state.verificationRequest) {
            this.state.verificationRequest.off("change", this.onVerificationRequestChange);
        }
        await request.accept();
        request.on("change", this.onVerificationRequestChange);
        this.setState({
            verificationRequest: request,
        });
    }

    onVerificationRequestChange = () => {
        if (this.state.verificationRequest.cancelled) {
            this.state.verificationRequest.off("change", this.onVerificationRequestChange);
            this.setState({
                verificationRequest: null,
            });
        }
    }

    onSkipClick = () => {
        this.setState({
            phase: PHASE_CONFIRM_SKIP,
        });
    }

    onSkipConfirmClick = () => {
        this.props.onFinished();
    }

    onSkipBackClick = () => {
        this.setState({
            phase: PHASE_INTRO,
        });
    }

    onDoneClick = () => {
        this.props.onFinished();
    }

    render() {
        const AuthPage = sdk.getComponent("auth.AuthPage");
        const CompleteSecurityBody = sdk.getComponent("auth.CompleteSecurityBody");
        const AccessibleButton = sdk.getComponent("elements.AccessibleButton");

        const {
            phase,
        } = this.state;

        let icon;
        let title;
        let body;

        if (this.state.verificationRequest) {
            const EncryptionPanel = sdk.getComponent("views.right_panel.EncryptionPanel");
            body = <EncryptionPanel
                layout="dialog"
                verificationRequest={this.state.verificationRequest}
                onClose={this.props.onFinished}
                member={MatrixClientPeg.get().getUser(this.state.verificationRequest.otherUserId)}
            />;
        } else if (phase === PHASE_INTRO) {
            const InlineSpinner = sdk.getComponent('elements.InlineSpinner');

            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning"></span>;
            title = _t("Complete security");
            body = (
                <div>
                    <p>{_t(
                        "Open an existing session & use it to verify this one, " +
                        "granting it access to encrypted messages.",
                    )}</p>
                    <p className="mx_CompleteSecurity_waiting"><InlineSpinner />{_t("Waiting…")}</p>
                    <p>{_t(
                        "If you can’t access one, <button>use your recovery key or passphrase.</button>",
                    {}, {
                        button: sub => <AccessibleButton element="span"
                            className="mx_linkButton"
                            onClick={this._onUsePassphraseClick}
                        >
                            {sub}
                        </AccessibleButton>,
                    })}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            kind="danger"
                            onClick={this.onSkipClick}
                        >
                            {_t("Skip")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_DONE) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_verified"></span>;
            title = _t("Session verified");
            let message;
            if (this.state.backupInfo) {
                message = <p>{_t(
                    "Your new session is now verified. It has access to your " +
                    "encrypted messages, and other users will see it as trusted.",
                )}</p>;
            } else {
                message = <p>{_t(
                    "Your new session is now verified. Other users will see it as trusted.",
                )}</p>;
            }
            body = (
                <div>
                    <div className="mx_CompleteSecurity_heroIcon mx_E2EIcon_verified"></div>
                    {message}
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            kind="primary"
                            onClick={this.onDoneClick}
                        >
                            {_t("Done")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_CONFIRM_SKIP) {
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning"></span>;
            title = _t("Are you sure?");
            body = (
                <div>
                    <p>{_t(
                        "Without completing security on this session, it won’t have " +
                        "access to encrypted messages.",
                    )}</p>
                    <div className="mx_CompleteSecurity_actionRow">
                        <AccessibleButton
                            className="warning"
                            kind="secondary"
                            onClick={this.onSkipConfirmClick}
                        >
                            {_t("Skip")}
                        </AccessibleButton>
                        <AccessibleButton
                            kind="danger"
                            onClick={this.onSkipBackClick}
                        >
                            {_t("Go Back")}
                        </AccessibleButton>
                    </div>
                </div>
            );
        } else if (phase === PHASE_BUSY) {
            const Spinner = sdk.getComponent('views.elements.Spinner');
            icon = <span className="mx_CompleteSecurity_headerIcon mx_E2EIcon_warning"></span>;
            title = _t("Complete security");
            body = <Spinner />;
        } else {
            throw new Error(`Unknown phase ${phase}`);
        }

        return (
            <AuthPage>
                <CompleteSecurityBody>
                    <h2 className="mx_CompleteSecurity_header">
                        {icon}
                        {title}
                    </h2>
                    <div className="mx_CompleteSecurity_body">
                        {body}
                    </div>
                </CompleteSecurityBody>
            </AuthPage>
        );
    }
}
